/**
 * Projects section: category filter and the pixel-art thumbnails.
 *
 * Projects without a screenshot or video get a small Space Invaders
 * scene: an invader, the project's tech logos in formation, and a
 * cannon. It's drawn once and only animates while the card is hovered.
 */
window.App.projects = (() => {
  "use strict";
  const { $, $$, theme, findLogo, drawLogo, prefersReducedMotion, fitCanvas, createLoop } = window.App;

  const INVADER_SPRITE = [
    "..#.....#..",
    "...#...#...",
    "..#######..",
    ".##.###.##.",
    "###########",
    "#.#######.#",
    "#.#.....#.#",
    "...##.##...",
  ];
  const INVADER_PIXEL = 5;
  const LOGO_SPACING = 54;
  const CANNON_COLOR = "#4ade80";

  // ── Filter ──────────────────────────────────────────────────
  function initFilter() {
    const filters = $("#project-filters");
    filters.addEventListener("click", (e) => {
      const button = e.target.closest(".filter");
      if (!button) return;

      $$(".filter", filters).forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-selected", String(b === button));
      });

      const category = button.dataset.category;
      $$(".project").forEach((card) => {
        const visible = category === "all" || card.dataset.category === category;
        card.hidden = !visible;
        if (visible) replayPopAnimation(card);
      });
    });
  }

  function replayPopAnimation(card) {
    card.classList.remove("pop");
    void card.offsetWidth; // force a reflow so the animation restarts
    card.classList.add("pop", "in-view");
  }

  // ── Thumbnails ──────────────────────────────────────────────
  class ProjectThumbnail {
    constructor(canvas, project) {
      this.canvas = canvas;
      this.logos = project.tags.map(findLogo).filter(Boolean);
      this.colors = [theme.gradient[project.accent % 3], theme.gradient[(project.accent + 1) % 3]];
      this.time = 0;
      this.loop = createLoop((dt) => { this.time += dt; this.draw(); });

      new ResizeObserver(() => this.resize()).observe(canvas);
      if (!prefersReducedMotion) {
        const card = canvas.closest(".project");
        card.addEventListener("pointerenter", () => this.loop.start());
        card.addEventListener("pointerleave", () => this.loop.stop());
      }
    }

    resize() {
      this.width = this.canvas.clientWidth;
      this.height = this.canvas.clientHeight;
      if (!this.width || !this.height) return;
      this.ctx = fitCanvas(this.canvas, this.width, this.height);
      this.draw();
    }

    draw() {
      if (!this.ctx) return;
      const { ctx, width, height } = this;
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, this.colors[0]);
      gradient.addColorStop(1, this.colors[1]);

      this.drawBackground(gradient);
      this.drawStars();
      this.drawInvader(gradient);
      this.drawLogoFormation();
      this.drawCannon();
    }

    drawBackground(gradient) {
      const { ctx, width, height } = this;
      ctx.fillStyle = "#07070a";
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }

    drawStars() {
      const { ctx, width, height, time } = this;
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      for (let i = 0; i < 24; i++) {
        // fixed pseudo-random positions that drift slowly sideways
        const x = (i * 53.7 + time * 6) % width;
        const y = (i * 31.3) % (height - 40);
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    drawInvader(gradient) {
      const { ctx, width, time } = this;
      const spriteWidth = INVADER_SPRITE[0].length * INVADER_PIXEL;
      const left = width / 2 - spriteWidth / 2 + Math.sin(time * 2) * 20;
      const top = 26 + (Math.floor(time * 2) % 2);
      ctx.fillStyle = gradient;
      INVADER_SPRITE.forEach((row, y) =>
        [...row].forEach((pixel, x) => {
          if (pixel === "#") ctx.fillRect(left + x * INVADER_PIXEL, top + y * INVADER_PIXEL, INVADER_PIXEL, INVADER_PIXEL);
        }),
      );
    }

    drawLogoFormation() {
      const { ctx, width, height, time } = this;
      const rowWidth = (this.logos.length - 1) * LOGO_SPACING;
      this.logos.forEach((logo, i) => {
        const x = width / 2 - rowWidth / 2 + i * LOGO_SPACING + Math.sin(time * 1.5) * 16;
        const y = height - 52 + (Math.floor(time * 4 + i) % 2) * 3; // two-frame march
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();
        drawLogo(ctx, logo, x, y, 22);
      });
    }

    drawCannon() {
      const { ctx, width, height, time } = this;
      const x = width / 2 + Math.sin(time * 3) * (width / 3);
      ctx.fillStyle = CANNON_COLOR;
      ctx.fillRect(x - 9, height - 10, 18, 5);
      ctx.fillRect(x - 2, height - 15, 4, 5);
    }
  }

  function initThumbnails(projects) {
    $$(".project-thumb canvas").forEach((canvas) => {
      new ProjectThumbnail(canvas, projects[Number(canvas.dataset.projectIndex)]);
    });
  }

  function init(projects) {
    initFilter();
    initThumbnails(projects);
  }

  return { init };
})();
