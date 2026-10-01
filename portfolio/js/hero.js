/**
 * Hero section: animated headline, typewriter roles and the
 * dashboard mockup (live bar chart + tilt-on-scroll).
 */
window.App.hero = (() => {
  "use strict";
  const { $, $$, escapeHtml: esc, prefersReducedMotion } = window.App;

  const TYPE_DELAY_MS = 80;
  const DELETE_DELAY_MS = 40;
  const HOLD_WORD_MS = 1600;
  const CHART_REFRESH_MS = 3500;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /** Splits the headline into words that animate in one after another. */
  function renderHeadline(lines) {
    let wordIndex = 0;
    const lastLine = lines.length - 1;
    $("#hero-title").innerHTML = lines
      .map((line, lineIndex) => {
        const words = line.split(" ").map((word) => {
          const delay = 0.15 + wordIndex++ * 0.08;
          const gradient = lineIndex === lastLine ? " gradient-text" : "";
          return `<span class="word${gradient}" style="animation-delay: ${delay}s">${esc(word)}</span>`;
        });
        return `<span class="line">${words.join(" ")}</span>`;
      })
      .join("");
  }

  /** Types each role, pauses, deletes it, then moves to the next. */
  function startTypewriter(roles) {
    const el = $("#typed-role");
    if (prefersReducedMotion) {
      el.textContent = roles[0];
      return;
    }
    let roleIndex = 0;
    let length = 0;
    let deleting = false;

    const tick = () => {
      const role = roles[roleIndex];
      el.textContent = role.slice(0, length);

      if (!deleting && length === role.length) {
        deleting = true;
        setTimeout(tick, HOLD_WORD_MS);
        return;
      }
      if (deleting && length === 0) {
        deleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
      }
      length += deleting ? -1 : 1;
      setTimeout(tick, deleting ? DELETE_DELAY_MS : TYPE_DELAY_MS);
    };
    tick();
  }

  // ── Mockup chart ────────────────────────────────────────────
  function buildChart() {
    $("#chart-bars").innerHTML = MONTHS.map(() => '<div class="bar"></div>').join("");
  }

  /** Gives every bar a new, roughly wave-shaped random height. */
  function shuffleChart() {
    $$("#chart-bars .bar").forEach((bar, i) => {
      const wave = 0.5 + 0.5 * Math.sin(i / 2 + Math.random());
      const value = Math.min(100, Math.round(25 + 60 * wave + Math.random() * 15));
      bar.style.height = `${value}%`;
      bar.dataset.label = `${MONTHS[i]} · ${value}k`;
    });
  }

  function startChartWhenVisible(mockup) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      shuffleChart();
      if (!prefersReducedMotion) {
        setInterval(() => { if (!document.hidden) shuffleChart(); }, CHART_REFRESH_MS);
      }
    });
    observer.observe(mockup);
  }

  /** The mockup starts tilted back and flattens as the page scrolls. */
  function tiltMockupOnScroll(mockup) {
    const FLAT_AFTER_PX = 500;
    const update = () => {
      const progress = Math.min(1, window.scrollY / FLAT_AFTER_PX);
      mockup.style.setProperty("--tilt", `${14 * (1 - progress)}deg`);
      mockup.style.setProperty("--scale", `${0.94 + 0.06 * progress}`);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function init(content) {
    renderHeadline(content.headline);
    startTypewriter(content.roles);

    const mockup = $("#mockup");
    buildChart();
    startChartWhenVisible(mockup);
    tiltMockupOnScroll(mockup);
  }

  return { init };
})();
