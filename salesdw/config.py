"""Loads config/settings.yaml and config/schema_mappings.yaml (env vars override settings)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _config_dir() -> Path:
    return Path(os.environ.get("SALESDW_CONFIG_DIR", PROJECT_ROOT / "config"))


def _resolve(path: str) -> Path:
    p = Path(path)
    return p if p.is_absolute() else PROJECT_ROOT / p


@dataclass
class Settings:
    database_url: str
    incoming: Path
    processed: Path
    failed: Path
    watch_interval_seconds: int
    base_currency: str
    fx_rates: dict[str, float]
    max_reject_ratio: float
    api_key: str | None
    mappings: dict = field(repr=False)

    def ensure_dirs(self) -> None:
        for p in (self.incoming, self.processed, self.failed):
            p.mkdir(parents=True, exist_ok=True)


def load_settings() -> Settings:
    cfg_dir = _config_dir()
    raw = yaml.safe_load((cfg_dir / "settings.yaml").read_text()) or {}
    mappings = yaml.safe_load((cfg_dir / "schema_mappings.yaml").read_text()) or {}
    paths = raw.get("paths", {})
    env = os.environ.get
    return Settings(
        database_url=env("DATABASE_URL", raw.get("database_url")),
        incoming=_resolve(env("SALESDW_INCOMING", paths.get("incoming", "data/incoming"))),
        processed=_resolve(env("SALESDW_PROCESSED", paths.get("processed", "data/processed"))),
        failed=_resolve(env("SALESDW_FAILED", paths.get("failed", "data/failed"))),
        watch_interval_seconds=int(env("WATCH_INTERVAL_SECONDS", raw.get("watch_interval_seconds", 30))),
        base_currency=raw.get("base_currency", "USD").upper(),
        fx_rates={k.upper(): float(v) for k, v in (raw.get("fx_rates") or {}).items()},
        max_reject_ratio=float(raw.get("max_reject_ratio", 0.5)),
        api_key=env("SALESDW_API_KEY") or None,
        mappings=mappings,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()
