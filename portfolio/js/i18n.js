/**
 * Language handling (English / Arabic).
 *
 * Picks the language (saved choice → ?lang= → browser language),
 * merges that language's text with the shared facts into
 * `App.content`, fills every [data-i18n] element, and switches the
 * page to right-to-left for Arabic. The toggle saves the choice and
 * reloads, which keeps every other script language-agnostic.
 */
window.App.i18n = (() => {
  "use strict";
  const { $$ } = window.App;
  const SOURCES = window.PORTFOLIO_CONTENT;
  const SUPPORTED = ["en", "ar"];
  const RTL = ["ar"];
  const STORAGE_KEY = "portfolio-lang";

  function readSavedLanguage() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  function saveLanguage(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* private mode: the choice just won't persist */ }
  }

  function detectLanguage() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    const candidates = [fromUrl, readSavedLanguage(), navigator.language?.slice(0, 2)];
    return candidates.find((lang) => SUPPORTED.includes(lang)) ?? "en";
  }

  /** Combines shared.js with one language file into the shape the renderers use. */
  function buildContent(lang) {
    const shared = SOURCES.shared;
    const text = SOURCES[lang];
    const fallback = SOURCES.en;
    return {
      ...shared,
      ...text,
      lang,
      name: shared.name[lang] ?? shared.name.en,
      stats: shared.stats.map((stat) => ({ ...stat, label: text.stats[stat.id] })),
      projects: shared.projects.map((project) => ({ ...project, ...text.projects[project.id] })),
      certifications: shared.certifications.map((cert) => ({ ...cert, ...text.certifications[cert.id] })),
      edgeguard: { ...shared.edgeguard, ...text.edgeguard },
      repoDescriptions: { ...fallback.repoDescriptions, ...text.repoDescriptions },
      t: (key) => text.ui[key] ?? fallback.ui[key] ?? key,
    };
  }

  /** Fills the fixed page labels. Strings come from our own content files, so HTML is allowed. */
  function applyLabels(t) {
    $$("[data-i18n]").forEach((el) => (el.innerHTML = t(el.dataset.i18n)));
    $$("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
    $$("[data-i18n-label]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
  }

  function init() {
    const lang = detectLanguage();
    const content = buildContent(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.includes(lang) ? "rtl" : "ltr";
    applyLabels(content.t);

    const toggle = document.getElementById("lang-toggle");
    toggle?.addEventListener("click", () => {
      saveLanguage(lang === "en" ? "ar" : "en");
      const url = new URL(location.href);
      url.searchParams.delete("lang");
      location.replace(url);
    });
    return content;
  }

  return { init };
})();
