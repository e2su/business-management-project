/**
 * Interactive EdgeGuard demo: choose a traffic class and the gauge
 * moves to the risk score the real inference engine assigns to it.
 * Scores and severity tiers come from shared.js (copied from the
 * project's inference_engine.py).
 */
window.App.edgeguardDemo = (() => {
  "use strict";
  const { $, $$, escapeHtml: esc } = window.App;

  const GAUGE_SWEEP_DEGREES = 180; // the needle sweeps a half circle
  const LEVEL_COLORS = { normal: "#22c55e", low: "#a3e635", medium: "#facc15", high: "#f97316", critical: "#ef4444" };

  function renderButtons(classes) {
    $("#demo-classes").innerHTML = classes
      .map((c, i) => `
        <button class="demo-class" type="button" role="radio" aria-checked="${i === 0}" data-class="${esc(c.id)}"
                style="--level-color: ${LEVEL_COLORS[c.level]}">
          ${esc(c.id)}
        </button>`)
      .join("");
  }

  function show(trafficClass, text) {
    const { score, level } = trafficClass;
    $("#gauge-fill").style.strokeDashoffset = String(100 - score);
    $("#gauge-needle").style.transform = `rotate(${(score / 100) * GAUGE_SWEEP_DEGREES - 90}deg)`;
    animateNumber($("#demo-score"), score);

    const levelEl = $("#demo-level");
    levelEl.textContent = text.levels[level];
    levelEl.style.color = LEVEL_COLORS[level];
    $("#demo-description").textContent = text.descriptions[trafficClass.id];

    const rule = $("#demo-rule");
    rule.hidden = !trafficClass.snortRule;
    rule.textContent = trafficClass.snortRule ?? "";

    $$(".demo-class").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.class === trafficClass.id)));
  }

  function animateNumber(el, to) {
    const from = Number(el.textContent) || 0;
    const start = performance.now();
    const duration = 700;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function init(edgeguard) {
    renderButtons(edgeguard.classes);
    const byId = new Map(edgeguard.classes.map((c) => [c.id, c]));
    $("#demo-classes").addEventListener("click", (e) => {
      const button = e.target.closest(".demo-class");
      if (button) show(byId.get(button.dataset.class), edgeguard);
    });
    show(edgeguard.classes[0], edgeguard);
  }

  return { init };
})();
