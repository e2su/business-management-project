/**
 * Shared helpers used by every other script.
 *
 * Exposes a single global, `window.App`, so the site works when
 * index.html is opened straight from disk (ES modules would need
 * a local server).
 */
window.App = (() => {
  "use strict";

  // ── DOM ─────────────────────────────────────────────────────
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

  const isExternalUrl = (url) => /^https?:\/\//.test(url);
  const linkTargetAttrs = (url) => (isExternalUrl(url) ? 'target="_blank" rel="noopener"' : "");

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover)").matches;

  // ── Theme (read from the CSS variables in css/tokens.css) ──
  const rootStyles = getComputedStyle(document.documentElement);
  const cssVar = (name, fallback) => rootStyles.getPropertyValue(name).trim() || fallback;
  const theme = {
    gradient: [cssVar("--g1", "#7c3aed"), cssVar("--g2", "#ec4899"), cssVar("--g3", "#f97316")],
  };

  // ── Colour ──────────────────────────────────────────────────
  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function hexToRgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  // ── Random ──────────────────────────────────────────────────
  const random = (min, max) => min + Math.random() * (max - min);
  const randomInt = (maxExclusive) => Math.floor(Math.random() * maxExclusive);
  const randomItem = (items) => items[randomInt(items.length)];

  // ── Logos (data in js/logos-data.js) ────────────────────────
  // Very dark brand colours (GitHub, Next.js…) disappear on black,
  // so those are drawn in light grey instead.
  const DARK_LOGO_THRESHOLD = 0.2;
  const DARK_LOGO_FALLBACK = "#e8e8ee";

  const logos = (window.APP_LOGOS || []).map((logo) => ({
    slug: logo.slug,
    title: logo.title,
    path: logo.path,
    color: luminance(logo.hex) < DARK_LOGO_THRESHOLD ? DARK_LOGO_FALLBACK : logo.hex,
    shape: new Path2D(logo.path),
  }));

  const findLogo = (title) => logos.find((logo) => logo.title.toLowerCase() === title.toLowerCase());

  const logoSvg = (logo) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${logo.path}"/></svg>`;

  /** Draws a 24×24 logo centred on (x, y) at the given pixel size. */
  function drawLogo(ctx, logo, x, y, size, color = logo.color) {
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ctx.fill(logo.shape);
    ctx.restore();
  }

  // ── Canvas & animation ──────────────────────────────────────
  /** Sizes a canvas for the screen's pixel density and returns its 2D context. */
  function fitCanvas(canvas, width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /**
   * requestAnimationFrame wrapper. `tick(dt)` receives seconds since
   * the last frame, capped so a background tab doesn't cause a jump.
   */
  function createLoop(tick, maxStep = 0.05) {
    let frameId = 0;
    let lastTime = 0;
    const frame = (now) => {
      const dt = Math.min(maxStep, (now - lastTime) / 1000);
      lastTime = now;
      tick(dt);
      frameId = requestAnimationFrame(frame);
    };
    return {
      start() {
        if (frameId) return;
        lastTime = performance.now();
        frameId = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(frameId);
        frameId = 0;
      },
    };
  }

  /** Runs `callback` once the user stops resizing the window. */
  function onResizeEnd(callback, delay = 150) {
    let timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(callback, delay);
    });
  }

  return {
    $, $$, escapeHtml, linkTargetAttrs,
    prefersReducedMotion, canHover, theme,
    hexToRgba, random, randomInt, randomItem,
    logos, findLogo, logoSvg, drawLogo,
    fitCanvas, createLoop, onResizeEnd,
  };
})();
