/**
 * Page-wide visual effects: scroll reveals, count-up numbers,
 * the spotlight that follows the pointer over cards, and the soft
 * glow that trails the cursor.
 */
window.App.effects = (() => {
  "use strict";
  const { $, $$, prefersReducedMotion, canHover } = window.App;

  const COUNT_UP_MS = 1600;
  const CURSOR_EASING = 0.12; // 0–1, higher follows the pointer more tightly

  /** Animates a number from 0 to its `data-count` value. */
  function countUp(el) {
    const end = Number(el.dataset.count);
    const decimals = Number(el.dataset.decimals ?? 0);
    const prefix = el.dataset.prefix ?? "";
    const suffix = el.dataset.suffix ?? "";
    const format = (n) =>
      `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

    if (prefersReducedMotion) {
      el.textContent = format(end);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const easeOut = 1 - (1 - t) ** 3;
      el.textContent = format(end * easeOut);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Fades `.reveal` elements in (and starts their counters) on first view. */
  function revealOnScroll() {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in-view");
          $$("[data-count]", entry.target).forEach(countUp);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    $$(".reveal").forEach((el) => observer.observe(el));
  }

  /** Feeds the pointer position to the `.card` hover gradient in CSS. */
  function cardSpotlight() {
    document.addEventListener(
      "pointermove",
      (e) => {
        const card = e.target.closest?.(".card");
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--pointer-x", `${e.clientX - rect.left}px`);
        card.style.setProperty("--pointer-y", `${e.clientY - rect.top}px`);
      },
      { passive: true },
    );
  }

  /** Tilts cards slightly in 3D towards the pointer. */
  function tiltOnHover(selector, maxDegrees = 8) {
    if (prefersReducedMotion || !canHover) return;
    $$(selector).forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          `perspective(900px) rotateY(${x * maxDegrees}deg) rotateX(${-y * maxDegrees}deg) translateY(-4px)`;
      });
      card.addEventListener("pointerleave", () => (card.style.transform = ""));
    });
  }

  /** A large soft glow that eases after the cursor. */
  function cursorGlow() {
    const glow = $(".cursor-glow");
    if (!glow || !canHover) return;
    const target = { x: -999, y: -999 };
    const current = { ...target };

    window.addEventListener("pointermove", (e) => { target.x = e.clientX; target.y = e.clientY; }, { passive: true });
    const follow = () => {
      current.x += (target.x - current.x) * CURSOR_EASING;
      current.y += (target.y - current.y) * CURSOR_EASING;
      glow.style.setProperty("--glow-x", `${current.x}px`);
      glow.style.setProperty("--glow-y", `${current.y}px`);
      requestAnimationFrame(follow);
    };
    follow();
  }

  function init() {
    revealOnScroll();
    cardSpotlight();
    tiltOnHover(".project");
    cursorGlow();
  }

  return { init };
})();
