// ─────────────────────────────────────────────────────────────
// Donkey-Kong style level for the "Stack" section. A pixel bug
// sits at the top and throws app logos down sloped girders
// (they sometimes take a ladder). The little dev at the bottom
// jumps over them. Click a rolling logo to smash it.
// ─────────────────────────────────────────────────────────────
(() => {
  "use strict";
  const canvas = document.getElementById("kong");
  if (!canvas || !window.ARCADE) return;
  const { G, LOGOS, drawLogo, reduced, rand, pick } = window.ARCADE;
  const ctx = canvas.getContext("2d");
  const tip = document.getElementById("kong-tip");
  const scoreEl = document.getElementById("kong-score");

  const GIRDERS = 5, THICK = 10, SLOPE = 16, BR = 15, GRAV = 1100;
  let W, H, dpr, girders = [], ladders = [], barrels = [], sparks = [], popups = [];
  let throwT = 1, throwAnim = 0, time = 0, smashed = 0, drumFlare = 0;
  let hero, hover = null, visible = false;

  // Pixel sprites: one char per pixel, mapped through a palette.
  const BUG = [
    "....a......a....",
    ".....a....a.....",
    "......bbbb......",
    "....bbbbbbbb....",
    "a..bbwkbbwkbb..a",
    ".a.bbbbbbbbbb.a.",
    "..bbccccccccbb..",
    "a.bbccccccccbb.a",
    ".abbccccccccbba.",
    "..bbccccccccbb..",
    "a..bbccccccbb..a",
    ".....bbbbbb.....",
  ];
  const DEV = [
    [
      "...hhhh...",
      "..hhhhhhh.",
      "..sskks...",
      ".sskssss..",
      "..ssss....",
      "..rrbrr...",
      ".rrrbbrrr.",
      "rrrrbbrrrr",
      "ss.bbbb.ss",
      "...bbbb...",
      "..bb..bb..",
      ".kkk..kkk.",
    ],
    [
      "...hhhh...",
      "..hhhhhhh.",
      "..sskks...",
      ".sskssss..",
      "..ssss....",
      "..rrbrr...",
      ".rrrbbrrr.",
      ".rrrbbrrs.",
      ".ss.bbb...",
      "...bbbb...",
      "...bbbb...",
      "...kkkk...",
    ],
  ];
  const PAL = { a: "#c9c9d6", b: G[0], c: G[1], w: "#ffffff", k: "#111114", h: G[1], s: "#f5c39b", r: G[2] };

  function sprite(rows, x, y, px, flip = false) {
    const w = rows[0].length;
    for (let j = 0; j < rows.length; j++) {
      for (let i = 0; i < w; i++) {
        const ch = rows[j][i];
        if (ch === ".") continue;
        ctx.fillStyle = PAL[ch];
        const ix = flip ? w - 1 - i : i;
        ctx.fillRect(Math.round(x + ix * px), Math.round(y + j * px), px, px);
      }
    }
  }

  // ── Level geometry ──────────────────────────────────────────
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = 18, gap = Math.min(110, W * 0.1), top = 92, bottom = H - 26;
    const step = (bottom - top - SLOPE) / (GIRDERS - 1);
    girders = [];
    for (let i = 0; i < GIRDERS; i++) {
      const lowRight = i % 2 === 0;
      const last = i === GIRDERS - 1;
      girders.push({
        x1: last || lowRight ? m : m + gap,
        x2: last || !lowRight ? W - m : W - m - gap,
        base: top + i * step,
        lowRight,
      });
    }
    ladders = [];
    for (let i = 0; i < GIRDERS - 1; i++) {
      const a = girders[i], b = girders[i + 1];
      const lo = Math.max(a.x1, b.x1) + 60, hi = Math.min(a.x2, b.x2) - 60;
      const n = W < 600 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const x = lo + ((k + 0.5) / n) * (hi - lo) + rand(-40, 40);
        ladders.push({ g: i, x });
      }
    }
    const last = girders[GIRDERS - 1];
    hero = hero || { x: W / 2, dir: 1, vy: 0, jump: 0, frame: 0 };
    hero.x = Math.min(Math.max(hero.x, last.x1 + 80), last.x2 - 80);
  }
  const surfaceY = (g, x) => {
    const t = (x - g.x1) / (g.x2 - g.x1);
    return g.base + SLOPE * (g.lowRight ? t : 1 - t);
  };
  const drum = () => {
    const g = girders[GIRDERS - 1];
    const x = g.lowRight ? g.x2 - 34 : g.x1 + 34;
    return { x, y: surfaceY(g, x) };
  };

  // ── Barrels ─────────────────────────────────────────────────
  function throwBarrel() {
    if (!LOGOS.length) return;
    const g = girders[0];
    barrels.push({
      g: 0, x: g.x1 + 96, y: 0, vy: 0,
      dir: g.lowRight ? 1 : -1,
      state: "roll", rot: 0,
      speed: rand(95, 135),
      logo: pick(LOGOS),
      skip: new Set(),
    });
    throwAnim = 0.35;
  }

  function updateBarrel(b, dt) {
    const g = girders[b.g];
    if (b.state === "roll") {
      b.x += b.dir * b.speed * dt;
      b.rot += (b.dir * b.speed * dt) / BR;
      b.y = surfaceY(g, b.x) - THICK / 2 - BR;
      // maybe take a ladder down
      for (const l of ladders) {
        if (l.g !== b.g || b.skip.has(l) || Math.abs(l.x - b.x) > 3) continue;
        b.skip.add(l);
        if (Math.random() < 0.3) { b.state = "ladder"; b.x = l.x; return true; }
      }
      const lowEnd = g.lowRight ? g.x2 : g.x1;
      if (b.g === GIRDERS - 1) {
        const d = drum();
        if ((g.lowRight && b.x >= d.x - 6) || (!g.lowRight && b.x <= d.x + 6)) { drumFlare = 0.6; return false; }
      } else if ((g.lowRight && b.x > lowEnd + 4) || (!g.lowRight && b.x < lowEnd - 4)) {
        b.state = "fall"; b.vy = 0;
      }
    } else if (b.state === "fall" || b.state === "ladder") {
      if (b.state === "fall") { b.vy += GRAV * dt; b.x += b.dir * 30 * dt; b.y += b.vy * dt; }
      else { b.y += 85 * dt; b.rot += dt * 2; }
      const next = girders[b.g + 1];
      const land = surfaceY(next, b.x) - THICK / 2 - BR;
      if (b.y >= land) {
        b.g++; b.y = land; b.state = "roll";
        b.dir = next.lowRight ? 1 : -1;
        if (b.vy > 300) sparksAt(b.x, b.y + BR, "#ffffff", 5);
      }
    }
    return b.x > -40 && b.x < W + 40;
  }

  function sparksAt(x, y, color, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(60, 260);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: rand(0.4, 0.9), color });
    }
  }

  // ── Hero ────────────────────────────────────────────────────
  function updateHero(dt) {
    const g = girders[GIRDERS - 1];
    const ground = surfaceY(g, hero.x) - THICK / 2;
    if (!hero.jump) {
      hero.x += hero.dir * 70 * dt;
      hero.frame += dt * 8;
      if (hero.x > g.x2 - 90) hero.dir = -1;
      if (hero.x < g.x1 + 90) hero.dir = 1;
      for (const b of barrels) {
        if (b.g !== GIRDERS - 1 || b.state !== "roll") continue;
        const dx = b.x - hero.x;
        const closing = Math.sign(dx) !== Math.sign(b.dir);
        if (closing && Math.abs(dx) < 62) { hero.jump = 1; hero.vy = -380; hero.h = 0; break; }
      }
    } else {
      hero.x += hero.dir * 70 * dt;
      hero.vy += GRAV * dt;
      hero.h += hero.vy * dt;
      if (hero.h >= 0) { hero.h = 0; hero.jump = 0; }
    }
    hero.y = ground + (hero.h || 0);
  }

  // ── Loop ────────────────────────────────────────────────────
  function update(dt) {
    time += dt;
    throwT -= dt;
    if (throwT <= 0) { throwBarrel(); throwT = rand(1.4, 2.6); }
    throwAnim = Math.max(0, throwAnim - dt);
    drumFlare = Math.max(0, drumFlare - dt);
    barrels = barrels.filter((b) => updateBarrel(b, dt));
    updateHero(dt);
    sparks = sparks.filter((s) => ((s.life -= dt), (s.vy += 500 * dt), (s.x += s.vx * dt), (s.y += s.vy * dt), s.life > 0));
    popups = popups.filter((p) => ((p.life -= dt), (p.y -= 30 * dt), p.life > 0));
  }

  function drawGirder(g, grad) {
    const y1 = surfaceY(g, g.x1), y2 = surfaceY(g, g.x2);
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x1, y1 - THICK / 2); ctx.lineTo(g.x2, y2 - THICK / 2);
    ctx.moveTo(g.x1, y1 + THICK / 2); ctx.lineTo(g.x2, y2 + THICK / 2);
    // truss zig-zag
    const segs = Math.floor((g.x2 - g.x1) / 14);
    for (let i = 0; i <= segs; i++) {
      const x = g.x1 + (i / segs) * (g.x2 - g.x1), y = surfaceY(g, x);
      const up = i % 2 === 0;
      if (i === 0) ctx.moveTo(x, y + (up ? -THICK / 2 : THICK / 2));
      else ctx.lineTo(x, y + (up ? -THICK / 2 : THICK / 2));
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawLadder(l) {
    const a = girders[l.g], b = girders[l.g + 1];
    const y1 = surfaceY(a, l.x) + THICK / 2, y2 = surfaceY(b, l.x) - THICK / 2;
    ctx.strokeStyle = "rgba(125, 249, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(l.x - 9, y1); ctx.lineTo(l.x - 9, y2);
    ctx.moveTo(l.x + 9, y1); ctx.lineTo(l.x + 9, y2);
    for (let y = y1 + 8; y < y2; y += 10) { ctx.moveTo(l.x - 9, y); ctx.lineTo(l.x + 9, y); }
    ctx.stroke();
  }

  function drawBarrel(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const hot = hover === b;
    ctx.beginPath();
    ctx.arc(0, 0, BR + (hot ? 2 : 0), 0, Math.PI * 2);
    ctx.fillStyle = "#0c0c10";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hot ? "#ffffff" : b.logo.color;
    ctx.stroke();
    ctx.rotate(b.rot);
    drawLogo(ctx, b.logo, 0, 0, BR * 1.15);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // starfield
    ctx.fillStyle = "rgba(255,255,255,.25)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 197.3) % W, y = (i * 71.7) % (H * 0.9);
      if ((i + Math.floor(time * 2)) % 7) ctx.fillRect(x, y, 1.5, 1.5);
    }
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, G[0]); grad.addColorStop(0.5, G[1]); grad.addColorStop(1, G[2]);
    ladders.forEach(drawLadder);
    girders.forEach((g) => drawGirder(g, grad));

    // boss + spare barrels
    const g0 = girders[0];
    const by = surfaceY(g0, g0.x1 + 40) - THICK / 2;
    const px = 4, bob = Math.sin(time * 4) * 2 - (throwAnim > 0 ? 6 : 0);
    sprite(BUG, g0.x1 + 12, by - BUG.length * px + bob, px, throwAnim > 0);
    // the next logo, held overhead
    const held = LOGOS[Math.floor(time / 2) % LOGOS.length];
    if (held && throwAnim <= 0) {
      const hx = g0.x1 + 44, hy = by - BUG.length * px - 12 + bob;
      ctx.beginPath(); ctx.arc(hx, hy, 11, 0, Math.PI * 2); ctx.fillStyle = "#0c0c10"; ctx.fill();
      ctx.strokeStyle = held.color; ctx.lineWidth = 1.5; ctx.stroke();
      drawLogo(ctx, held, hx, hy, 13);
    }
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillStyle = "#c9c9d6";
    ctx.textAlign = "left";
    ctx.fillText("THE BUG", g0.x1 + 80, by - 30);

    // goal on top right
    ctx.textAlign = "right";
    ctx.fillStyle = Math.floor(time * 2) % 2 ? G[1] : "#ffffff";
    ctx.fillText("SHIP IT! ♥", W - 22, 60);

    // /dev/null drum
    const d = drum();
    ctx.save();
    ctx.translate(d.x, d.y - THICK / 2);
    ctx.fillStyle = "#101016";
    ctx.strokeStyle = G[2];
    ctx.lineWidth = 2;
    ctx.fillRect(-20, -40, 40, 40);
    ctx.strokeRect(-20, -40, 40, 40);
    ctx.fillStyle = "#c9c9d6";
    ctx.font = "6px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("/dev/", 0, -24);
    ctx.fillText("null", 0, -14);
    const fl = 8 + Math.sin(time * 20) * 3 + drumFlare * 30;
    ctx.fillStyle = G[2];
    ctx.beginPath(); ctx.moveTo(-14, -40); ctx.quadraticCurveTo(-6, -40 - fl * 1.4, 0, -40 - fl * 2); ctx.quadraticCurveTo(6, -40 - fl * 1.4, 14, -40); ctx.fill();
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath(); ctx.moveTo(-7, -40); ctx.quadraticCurveTo(0, -40 - fl * 1.2, 7, -40); ctx.fill();
    ctx.restore();

    barrels.forEach(drawBarrel);

    // hero
    const hp = 3, frames = DEV, f = hero.jump ? frames[1] : frames[Math.floor(hero.frame) % 2];
    sprite(f, hero.x - (f[0].length * hp) / 2, hero.y - f.length * hp, hp, hero.dir < 0);

    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 1.5));
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    for (const p of popups) {
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.fillStyle = "#7df9ff";
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  let last = 0, running = false;
  function loop(ts) {
    if (!visible) { running = false; return; }
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduced) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  // ── Interaction ─────────────────────────────────────────────
  function barrelAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let found = null;
    for (const b of barrels) if (Math.hypot(b.x - x, b.y - y) < BR + 8) found = b;
    return { found, x, y };
  }
  canvas.addEventListener("pointermove", (e) => {
    const { found } = barrelAt(e);
    hover = found;
    canvas.style.cursor = found ? "pointer" : "crosshair";
    if (found) {
      tip.textContent = found.logo.title;
      tip.style.left = `${found.x}px`;
      tip.style.top = `${found.y - BR}px`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  canvas.addEventListener("pointerleave", () => { hover = null; tip.style.opacity = 0; });
  canvas.addEventListener("pointerdown", (e) => {
    const { found } = barrelAt(e);
    if (!found) return;
    barrels = barrels.filter((b) => b !== found);
    sparksAt(found.x, found.y, found.logo.color, 22);
    popups.push({ x: found.x, y: found.y - 20, text: "+300", life: 1 });
    smashed++;
    scoreEl.textContent = String(smashed).padStart(3, "0");
    hover = null;
    tip.style.opacity = 0;
    if (reduced) draw();
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  }).observe(canvas);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); draw(); }, 150);
  });

  layout();
  // seed a few barrels so the level is busy on first view
  for (let i = 0; i < 3; i++) { throwBarrel(); for (let k = 0; k < 90 * (i + 1); k++) update(1 / 60); }
  draw();
})();
