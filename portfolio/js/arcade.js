// ─────────────────────────────────────────────────────────────
// Pac-Man style background. App logos are the ghosts; Pac-Man
// eats pellets, grabs power pellets and then hunts the logos.
// Move the mouse near a ghost to scare it. Press "Play" (or
// type the Konami code) to take control with the arrow keys.
// ─────────────────────────────────────────────────────────────
(() => {
  "use strict";

  const css = getComputedStyle(document.documentElement);
  const G = ["--g1", "--g2", "--g3"].map((v, i) => css.getPropertyValue(v).trim() || ["#7c3aed", "#ec4899", "#f97316"][i]);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const luminance = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };
  // Dark brand colours (GitHub, Next.js…) would vanish on black, so lift them.
  const LOGOS = (window.APP_LOGOS || []).map((l) => ({
    ...l,
    color: luminance(l.hex) < 0.2 ? "#e8e8ee" : l.hex,
    p: new Path2D(l.path),
  }));
  const drawLogo = (ctx, logo, x, y, size, color) => {
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color || logo.color;
    ctx.fill(logo.p);
    ctx.restore();
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  // Shared with kong.js / main.js
  window.ARCADE = { G, LOGOS, drawLogo, reduced, rand, pick };

  const canvas = document.getElementById("arcade");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const CELL = 56;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // right, down, left, up
  const KEYMAP = { ArrowRight: 0, d: 0, D: 0, ArrowDown: 1, s: 1, S: 1, ArrowLeft: 2, a: 2, A: 2, ArrowUp: 3, w: 3, W: 3 };

  let W, H, dpr, cols, rows, offX, offY;
  let blocked = new Set();
  let wallLayer, vignette;
  let pellets = new Map();
  let pac, ghosts = [], popups = [], sparks = [];
  let frightT = 0, combo = 0, time = 0;
  let playing = false, score = 0, lives = 3, banner = null;
  const mouse = { x: -1e4, y: -1e4 };

  const nx = (c) => offX + c * CELL;
  const ny = (r) => offY + r * CELL;
  const edgeKey = (c, r, d) => {
    // normalise so both directions map to the same edge
    if (d === 2) return `${c - 1},${r},0`;
    if (d === 3) return `${c},${r - 1},1`;
    return `${c},${r},${d}`;
  };
  const isOpen = (c, r, d) => {
    const c2 = c + DIRS[d][0], r2 = r + DIRS[d][1];
    return c2 >= 0 && r2 >= 0 && c2 < cols && r2 < rows && !blocked.has(edgeKey(c, r, d));
  };

  // ── Maze: every cell is a wall block; some blocks merge into
  //    bigger ones, which closes the corridor that ran through them.
  function buildMaze() {
    blocked = new Set();
    const used = new Set();
    const blocks = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        if (used.has(`${c},${r}`)) continue;
        let w = 1, h = 1;
        const roll = Math.random();
        if (roll < 0.22 && c < cols - 2 && !used.has(`${c + 1},${r}`)) w = 2;
        else if (roll < 0.4 && r < rows - 2) h = 2;
        else if (roll < 0.48 && c < cols - 2 && r < rows - 2 && !used.has(`${c + 1},${r}`)) { w = 2; h = 2; }
        for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) used.add(`${c + i},${r + j}`);
        blocks.push({ c, r, w, h });
        // close corridors that run through the inside of merged blocks
        for (let i = 1; i < w; i++) for (let j = 0; j < h; j++) blocked.add(`${c + i},${r + j},1`);
        for (let j = 1; j < h; j++) for (let i = 0; i < w; i++) blocked.add(`${c + i},${r + j},0`);
      }
    }
    // Pre-render walls once per resize.
    wallLayer = document.createElement("canvas");
    wallLayer.width = W * dpr;
    wallLayer.height = H * dpr;
    const w = wallLayer.getContext("2d");
    w.scale(dpr, dpr);
    const grad = w.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, G[0]);
    grad.addColorStop(0.5, G[1]);
    grad.addColorStop(1, G[2]);
    w.strokeStyle = grad;
    w.lineWidth = 2;
    w.globalAlpha = 0.28;
    const pad = 11;
    for (const b of blocks) {
      const x = nx(b.c) + pad, y = ny(b.r) + pad;
      const bw = b.w * CELL - pad * 2, bh = b.h * CELL - pad * 2;
      w.beginPath();
      w.roundRect ? w.roundRect(x, y, bw, bh, 7) : w.rect(x, y, bw, bh);
      w.stroke();
    }
  }

  // Pellets live on nodes and on the midpoint of each open edge,
  // keyed in half-cell units.
  function seedPellets() {
    pellets = new Map();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.7) pellets.set(`${c * 2},${r * 2}`, 1);
        if (isOpen(c, r, 0) && Math.random() < 0.7) pellets.set(`${c * 2 + 1},${r * 2}`, 1);
        if (isOpen(c, r, 1) && Math.random() < 0.7) pellets.set(`${c * 2},${r * 2 + 1}`, 1);
      }
    }
    for (let i = 0; i < 4; i++) pellets.set(`${((Math.random() * cols) | 0) * 2},${((Math.random() * rows) | 0) * 2}`, 2);
    pellets.total = pellets.size;
  }

  // ── Entities ────────────────────────────────────────────────
  function makeEntity(c, r, brain) {
    return { c, r, tc: c, tr: r, t: 0, dir: 0, moving: false, brain };
  }
  function position(e) {
    return [nx(e.c + (e.tc - e.c) * e.t), ny(e.r + (e.tr - e.r) * e.t)];
  }
  function choose(e) {
    const opts = [0, 1, 2, 3].filter((d) => isOpen(e.c, e.r, d));
    const d = e.brain(e, opts);
    if (d == null) { e.moving = false; e.tc = e.c; e.tr = e.r; return; }
    e.dir = d;
    e.tc = e.c + DIRS[d][0];
    e.tr = e.r + DIRS[d][1];
    e.moving = true;
  }
  function advance(e, dt, speed) {
    if (!e.moving) { choose(e); if (!e.moving) return; }
    e.t += speed * dt;
    while (e.t >= 1) {
      e.c = e.tc; e.r = e.tr; e.t -= 1;
      choose(e);
      if (!e.moving) { e.t = 0; break; }
    }
  }
  function reverse(e) {
    [e.c, e.tc] = [e.tc, e.c];
    [e.r, e.tr] = [e.tr, e.r];
    e.t = 1 - e.t;
    e.dir = (e.dir + 2) % 4;
  }
  // Greedy steering: pick the option that gets closest to (or
  // furthest from) a point, avoiding U-turns, with a bit of noise.
  function steer(e, opts, tx, ty, away = false, noise = 0.15) {
    const fwd = opts.filter((d) => d !== (e.dir + 2) % 4);
    const list = fwd.length ? fwd : opts;
    if (!list.length) return null;
    if (Math.random() < noise) return pick(list);
    let best = list[0], bestScore = Infinity;
    for (const d of list) {
      const dx = nx(e.c + DIRS[d][0]) - tx, dy = ny(e.r + DIRS[d][1]) - ty;
      const s = (away ? -1 : 1) * (dx * dx + dy * dy);
      if (s < bestScore) { bestScore = s; best = d; }
    }
    return best;
  }

  let pacTarget = null;
  let wanted = null;
  function pacBrain(e, opts) {
    if (pac.dead) return null;
    if (playing) {
      if (wanted != null && opts.includes(wanted)) return wanted;
      return opts.includes(e.dir) ? e.dir : null;
    }
    const [px, py] = [nx(e.c), ny(e.r)];
    // run from nearby non-frightened ghosts
    for (const g of ghosts) {
      if (g.state !== "chase") continue;
      const [gx, gy] = position(g);
      if (Math.hypot(gx - px, gy - py) < CELL * 2.2) return steer(e, opts, gx, gy, true, 0);
    }
    if (frightT > 0) {
      const prey = ghosts.filter((g) => g.state === "fright");
      if (prey.length) {
        const [gx, gy] = position(prey.reduce((a, b) => (dist2(a, px, py) < dist2(b, px, py) ? a : b)));
        return steer(e, opts, gx, gy, false, 0.05);
      }
    }
    if (!pacTarget || !pellets.has(pacTarget.k)) pacTarget = nearestPellet(px, py);
    if (!pacTarget) return steer(e, opts, W / 2, H / 2, false, 0.6);
    return steer(e, opts, pacTarget.x, pacTarget.y, false, 0.08);
  }
  const dist2 = (g, x, y) => { const [gx, gy] = position(g); return (gx - x) ** 2 + (gy - y) ** 2; };
  function nearestPellet(x, y) {
    let best = null, bd = Infinity;
    for (const [k, v] of pellets) {
      const [hx, hy] = k.split(",").map(Number);
      const px = offX + (hx * CELL) / 2, py = offY + (hy * CELL) / 2;
      const d = (px - x) ** 2 + (py - y) ** 2 - (v === 2 ? 4e4 : 0);
      if (d < bd) { bd = d; best = { k, x: px, y: py }; }
    }
    return best;
  }

  function ghostBrain(e, opts) {
    const [x, y] = [nx(e.c), ny(e.r)];
    if (e.state === "eyes") {
      if (e.c === e.home[0] && e.r === e.home[1]) { revive(e); }
      else return steer(e, opts, nx(e.home[0]), ny(e.home[1]), false, 0.02);
    }
    if (!playing && Math.hypot(mouse.x - x, mouse.y - y) < 170) return steer(e, opts, mouse.x, mouse.y, true, 0);
    const [px, py] = position(pac);
    if (e.state === "fright") return steer(e, opts, px, py, true, 0.25);
    switch (e.persona) {
      case 0: return steer(e, opts, px, py, false, 0.12); // chaser
      case 1: return steer(e, opts, px + DIRS[pac.dir][0] * CELL * 4, py + DIRS[pac.dir][1] * CELL * 4, false, 0.15); // ambusher
      case 2: return steer(e, opts, e.corner[0], e.corner[1], false, 0.3); // patrol
      default: return steer(e, opts, px, py, false, 0.55); // wanderer
    }
  }

  let logoCursor = 0;
  function nextLogo() {
    logoCursor = (logoCursor + 1) % LOGOS.length;
    return LOGOS[logoCursor];
  }
  function revive(g) {
    g.state = "chase";
    g.logo = nextLogo();
  }
  function spawnActors() {
    const cc = (cols / 2) | 0, cr = (rows / 2) | 0;
    pac = makeEntity(cc, Math.min(rows - 1, cr + 2), pacBrain);
    pac.dead = 0;
    const count = Math.max(3, Math.min(6, Math.round((cols * rows) / 70)));
    const corners = [[0, 0], [W, 0], [0, H], [W, H]];
    ghosts = [];
    for (let i = 0; i < count; i++) {
      const c = (Math.random() * cols) | 0, r = i % 2 ? 0 : rows - 1;
      const g = makeEntity(c, r, ghostBrain);
      g.state = "chase";
      g.persona = i % 4;
      g.corner = corners[i % 4];
      g.home = [cc, cr];
      g.logo = LOGOS.length ? LOGOS[(logoCursor = (logoCursor + 1) % LOGOS.length)] : null;
      g.speedJitter = rand(0.9, 1.05);
      ghosts.push(g);
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.max(5, Math.floor(W / CELL));
    rows = Math.max(5, Math.floor(H / CELL));
    offX = (W - (cols - 1) * CELL) / 2;
    offY = (H - (rows - 1) * CELL) / 2;
    vignette = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.6);
    vignette.addColorStop(0, "rgba(0,0,0,.7)");
    vignette.addColorStop(1, "rgba(0,0,0,0)");
    buildMaze();
    seedPellets();
    spawnActors();
  }

  // ── Game logic ──────────────────────────────────────────────
  function eat() {
    const [x, y] = position(pac);
    const hx = Math.round(((x - offX) / CELL) * 2), hy = Math.round(((y - offY) / CELL) * 2);
    const k = `${hx},${hy}`;
    const v = pellets.get(k);
    if (!v) return;
    const px = offX + (hx * CELL) / 2, py = offY + (hy * CELL) / 2;
    if (Math.abs(px - x) + Math.abs(py - y) > 10) return;
    pellets.delete(k);
    if (v === 2) {
      frightT = 7;
      combo = 0;
      for (const g of ghosts) if (g.state === "chase") { g.state = "fright"; reverse(g); }
      addScore(50, x, y, false);
    } else addScore(10, x, y, false);
    if (pellets.size < pellets.total * 0.2) seedPellets();
  }
  function addScore(n, x, y, show = true) {
    if (playing) {
      score += n;
      const el = document.getElementById("hud-score");
      if (el) el.textContent = score;
    }
    if (show) popups.push({ x, y, text: String(n), life: 1.1 });
  }
  function collide() {
    if (pac.dead) return;
    const [px, py] = position(pac);
    for (const g of ghosts) {
      const [gx, gy] = position(g);
      if (Math.hypot(gx - px, gy - py) > CELL * 0.45) continue;
      if (g.state === "fright") {
        combo++;
        addScore(100 * 2 ** combo, gx, gy);
        burst(gx, gy, g.logo ? g.logo.color : G[1]);
        g.state = "eyes";
      } else if (g.state === "chase") {
        pac.dead = 1.4;
        pac.moving = false;
        if (playing) {
          lives--;
          const el = document.getElementById("hud-lives");
          if (el) el.textContent = Math.max(0, lives);
        }
        return;
      }
    }
  }
  function burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      sparks.push({ x, y, vx: Math.cos(a) * rand(60, 160), vy: Math.sin(a) * rand(60, 160), life: rand(0.4, 0.8), color });
    }
  }
  function respawnPac() {
    if (playing && lives <= 0) {
      banner = { text: "GAME OVER", life: 2.6 };
      score = 0; lives = 3;
      setTimeout(() => {
        const s = document.getElementById("hud-score"), l = document.getElementById("hud-lives");
        if (s) s.textContent = 0;
        if (l) l.textContent = 3;
        seedPellets();
      }, 1200);
    }
    const cc = (cols / 2) | 0, cr = Math.min(rows - 1, ((rows / 2) | 0) + 2);
    Object.assign(pac, { c: cc, r: cr, tc: cc, tr: cr, t: 0, moving: false, dead: 0 });
    for (const g of ghosts) {
      const c = (Math.random() * cols) | 0, r = Math.random() < 0.5 ? 0 : rows - 1;
      Object.assign(g, { c, r, tc: c, tr: r, t: 0, moving: false });
      if (g.state !== "eyes") g.state = "chase";
    }
    if (playing) banner = banner || { text: "READY!", life: 1.4 };
  }

  function update(dt) {
    time += dt;
    if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
    if (frightT > 0) {
      frightT -= dt;
      if (frightT <= 0) for (const g of ghosts) if (g.state === "fright") g.state = "chase";
    }
    if (banner && banner.text === "READY!") return; // everyone waits for the start
    if (pac.dead) {
      pac.dead -= dt;
      if (pac.dead <= 0) respawnPac();
    } else {
      advance(pac, dt, playing ? 5.2 : 4.4);
      eat();
    }
    for (const g of ghosts) {
      const sp = g.state === "eyes" ? 9 : g.state === "fright" ? 2.4 : (playing ? 4.3 : 3.6) * g.speedJitter;
      if (!pac.dead || g.state === "eyes") advance(g, dt, sp);
    }
    collide();
    popups = popups.filter((p) => ((p.life -= dt), (p.y -= 24 * dt), p.life > 0));
    sparks = sparks.filter((s) => ((s.life -= dt), (s.x += s.vx * dt), (s.y += s.vy * dt), s.life > 0));
  }

  // ── Drawing ─────────────────────────────────────────────────
  function drawPac() {
    const [x, y] = position(pac);
    const R = CELL * 0.34;
    ctx.save();
    ctx.translate(x, y);
    const grad = ctx.createLinearGradient(-R, -R, R, R);
    grad.addColorStop(0, "#ffe14d");
    grad.addColorStop(1, G[2]);
    ctx.fillStyle = grad;
    ctx.shadowColor = G[2];
    ctx.shadowBlur = 18;
    if (pac.dead) {
      // classic "deflate" death animation
      const k = Math.max(0, pac.dead - 0.2) / 1.2;
      const open = Math.PI * (1 - k);
      ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, open, Math.PI * 2 - open);
      ctx.closePath();
      if (k > 0) ctx.fill();
    } else {
      const mouth = (pac.moving ? Math.abs(Math.sin(time * 14)) : 0.4) * 0.32 * Math.PI;
      ctx.rotate((pac.dir * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, mouth, Math.PI * 2 - mouth);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGhost(g) {
    const [x, y] = position(g);
    const s = CELL * 0.72, w = s / 2, top = y - s * 0.12;
    const eyesOnly = g.state === "eyes";
    if (!eyesOnly) {
      const flash = g.state === "fright" && frightT < 2 && Math.floor(time * 6) % 2 === 0;
      const base = g.state === "fright" ? (flash ? "#f5f5f7" : "#2b2bd9") : g.logo ? g.logo.color : G[1];
      ctx.beginPath();
      ctx.moveTo(x - w, y + w);
      ctx.lineTo(x - w, top);
      ctx.arc(x, top, w, Math.PI, 0);
      ctx.lineTo(x + w, y + w);
      const waves = 4, seg = (w * 2) / waves, wob = Math.floor(time * 8) % 2;
      for (let i = 0; i < waves; i++) {
        const x0 = x + w - seg * i;
        ctx.lineTo(x0 - seg / 2, y + w - (i % 2 === wob ? 6 : 3));
        ctx.lineTo(x0 - seg, y + w);
      }
      ctx.closePath();
      ctx.fillStyle = g.state === "fright" ? base : hexA(base, 0.16);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = base;
      ctx.stroke();
      if (g.logo) drawLogo(ctx, g.logo, x, y + 1, s * 0.5, g.state === "fright" ? (flash ? "#2b2bd9" : "#f5f5f7") : g.logo.color);
    }
    // eyes look where the ghost is heading
    if (g.state !== "fright") {
      const [dx, dy] = DIRS[g.dir];
      for (const ex of [-0.38, 0.38]) {
        const cx = x + ex * w, cy = top - w * 0.35;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(cx, cy, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1d4ed8";
        ctx.beginPath(); ctx.arc(cx + dx * 2, cy + dy * 2, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  const hexA = (hex, a) => {
    if (!hex.startsWith("#")) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(wallLayer, 0, 0, W, H);
    // pellets
    ctx.fillStyle = "rgba(255, 214, 170, 0.55)";
    const blink = Math.floor(time * 3) % 2 === 0;
    for (const [k, v] of pellets) {
      const i = k.indexOf(",");
      const x = offX + (+k.slice(0, i) * CELL) / 2, y = offY + (+k.slice(i + 1) * CELL) / 2;
      if (v === 2) {
        if (!blink) continue;
        ctx.save();
        ctx.fillStyle = G[1];
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    for (const g of ghosts) drawGhost(g);
    drawPac();
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, s.life);
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
    // soften the middle of the screen so text stays readable
    if (!playing) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
    if (banner) {
      ctx.font = "22px 'Press Start 2P', monospace";
      ctx.fillStyle = banner.text === "READY!" ? "#ffe14d" : "#ff4d6d";
      ctx.fillText(banner.text, W / 2, H / 2);
    }
  }

  let last = 0, rafId = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  // ── Public controls ─────────────────────────────────────────
  function setPlaying(on) {
    if (on === playing) return;
    playing = on;
    document.body.classList.toggle("playing", on);
    wanted = null;
    if (on) {
      score = 0; lives = 3;
      document.getElementById("hud-score").textContent = "0";
      document.getElementById("hud-lives").textContent = "3";
      seedPellets();
      respawnPac();
      banner = { text: "READY!", life: 1.4 };
      if (reduced && !rafId) rafId = requestAnimationFrame(loop);
    }
  }
  window.ARCADE.setPlaying = setPlaying;
  window.ARCADE.isPlaying = () => playing;

  window.addEventListener("keydown", (e) => {
    if (!playing) return;
    if (e.key === "Escape") { setPlaying(false); return; }
    if (e.key in KEYMAP) {
      e.preventDefault();
      wanted = KEYMAP[e.key];
      if (pac.moving && wanted === (pac.dir + 2) % 4) reverse(pac);
      else if (!pac.moving) choose(pac);
    }
  });
  // swipe controls on touch screens while playing
  let touch0 = null;
  window.addEventListener("touchstart", (e) => { if (playing) touch0 = e.touches[0]; }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (!playing || !touch0) return;
    const t = e.changedTouches[0], dx = t.clientX - touch0.clientX, dy = t.clientY - touch0.clientY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    wanted = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
    if (!pac.moving) choose(pac);
  });
  window.addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  window.addEventListener("pointerleave", () => { mouse.x = mouse.y = -1e4; });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); if (reduced) draw(); }, 150);
  });

  resize();
  if (reduced) draw();
  else rafId = requestAnimationFrame(loop);
})();
