/**
 * Hero section: animated headline, typewriter roles and the
 * project preview window (pipeline diagram + terminal replaying
 * real log lines from the MARKET_OS README, tilting on scroll).
 */
window.App.hero = (() => {
  "use strict";
  const { $, escapeHtml: esc, prefersReducedMotion, findLogo, logoSvg } = window.App;

  const TYPE_DELAY_MS = 80;
  const DELETE_DELAY_MS = 40;
  const HOLD_WORD_MS = 1600;
  const TERMINAL_CHAR_MS = 28;
  const TERMINAL_LINE_PAUSE_MS = 450;
  const TERMINAL_RESTART_MS = 4000;

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

  // ── Pipeline diagram ────────────────────────────────────────
  function renderPipeline(stages) {
    $("#pipeline").innerHTML = stages
      .map((stage) => {
        const logo = stage.logo && findLogo(stage.logo);
        const icon = logo ? `<span class="stage-icon" style="--brand: ${logo.color}">${logoSvg(logo)}</span>` : '<span class="stage-icon stage-icon-empty"></span>';
        return `<li class="stage">${icon}<span>${esc(stage.label)}</span></li>`;
      })
      .join('<li class="link" aria-hidden="true"></li>');
  }

  // ── Terminal ────────────────────────────────────────────────
  /**
   * Replays the lines one character at a time: commands get a "$"
   * prompt, output lines appear in a muted colour. Loops forever.
   */
  function startTerminal(lines) {
    const el = $("#terminal");
    const render = (count, partial = "") =>
      lines
        .slice(0, count)
        .map((line) => lineHtml(line))
        .concat(partial ? [lineHtml(lines[count], partial)] : [])
        .join("");

    if (prefersReducedMotion) {
      el.innerHTML = render(lines.length);
      return;
    }

    let lineIndex = 0;
    let charIndex = 0;
    const tick = () => {
      if (lineIndex === lines.length) {
        setTimeout(() => { lineIndex = 0; charIndex = 0; tick(); }, TERMINAL_RESTART_MS);
        return;
      }
      const chars = [...lineText(lines[lineIndex])]; // spread keeps emoji in one piece
      charIndex++;
      el.innerHTML = render(lineIndex, chars.slice(0, charIndex).join("")) + '<span class="terminal-cursor"></span>';
      if (charIndex >= chars.length) {
        lineIndex++;
        charIndex = 0;
        setTimeout(tick, TERMINAL_LINE_PAUSE_MS);
      } else {
        // output lines appear faster than typed commands
        setTimeout(tick, lines[lineIndex].cmd ? TERMINAL_CHAR_MS * 2 : TERMINAL_CHAR_MS / 2);
      }
    };
    tick();
  }
  const lineText = (line) => line.cmd ?? line.out;
  const lineHtml = (line, text = lineText(line)) =>
    line.cmd
      ? `<span class="terminal-line"><span class="terminal-prompt">$</span> ${esc(text)}</span>`
      : `<span class="terminal-line terminal-output">${esc(text)}</span>`;

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

    renderPipeline(content.pipeline);
    startTerminal(content.terminal);
    tiltMockupOnScroll($("#mockup"));
  }

  return { init };
})();
