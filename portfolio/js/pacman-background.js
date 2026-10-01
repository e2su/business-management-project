/**
 * Pac-Man style animated background.
 *
 * The screen is a grid of corridors between rounded wall blocks.
 * The ghosts are app logos in rounded squares. Pac-Man eats pellets, and after a power
 * pellet the ghosts turn blue and Pac-Man chases them. Ghosts run
 * away from the mouse pointer.
 *
 * Overview:
 *   Grid     – converts grid coordinates to screen pixels
 *   Maze     – wall blocks and which corridors are closed
 *   Pellets  – the dots, keyed by half-cell position
 *   Actor    – something that moves from grid node to grid node
 *   PacmanBackground – the game loop that ties it all together
 */
(() => {
  "use strict";
  const { $, theme, logos, drawLogo, hexToRgba, random, randomInt, randomItem,
          prefersReducedMotion, fitCanvas, createLoop, onResizeEnd } = window.App;

  const CONFIG = {
    cellSize: 56,              // px between corridor centres
    wallInset: 11,             // px gap between a wall and its corridor
    pelletChance: 0.7,         // share of grid points that get a pellet
    powerPelletCount: 4,
    refillWhenBelow: 0.2,      // refill pellets when this share is left
    frightenedSeconds: 7,
    deathSeconds: 1.4,
    mouseScareRadius: 170,     // px
    speed: { pacman: 4.4, ghost: 3.6, frightened: 2.4, returning: 9 }, // cells per second
  };

  const COLORS = {
    pellet: "rgba(255, 214, 170, 0.55)",
    pacmanTop: "#ffe14d",
    frightened: "#2b2bd9",
    frightenedFlash: "#f5f5f7",
    score: "#7df9ff",
  };

  // right, down, left, up — index order matters for rotation maths
  const DIRECTIONS = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }];
  const opposite = (dir) => (dir + 2) % 4;

  const GHOST_STATE = { CHASE: "chase", FRIGHTENED: "frightened", RETURNING: "returning" };
  const PERSONALITIES = ["chaser", "ambusher", "patroller", "wanderer"];

  // ── Grid ────────────────────────────────────────────────────
  class Grid {
    constructor(width, height, cellSize) {
      this.cellSize = cellSize;
      this.cols = Math.max(5, Math.floor(width / cellSize));
      this.rows = Math.max(5, Math.floor(height / cellSize));
      // centre the grid on screen
      this.offsetX = (width - (this.cols - 1) * cellSize) / 2;
      this.offsetY = (height - (this.rows - 1) * cellSize) / 2;
    }
    x(col) { return this.offsetX + col * this.cellSize; }
    y(row) { return this.offsetY + row * this.cellSize; }
    contains(col, row) { return col >= 0 && row >= 0 && col < this.cols && row < this.rows; }
    get center() { return { col: Math.floor(this.cols / 2), row: Math.floor(this.rows / 2) }; }
  }

  // ── Maze ────────────────────────────────────────────────────
  // Every cell between four grid nodes is a wall block. Some blocks
  // are merged into 2×1, 1×2 or 2×2 blocks, which closes the
  // corridor that used to run through the middle of them.
  class Maze {
    constructor(grid) {
      this.grid = grid;
      this.blocks = [];
      this.closedEdges = new Set();
      this.generate();
    }

    // An edge is stored once, from its left/top node.
    static edgeKey(col, row, dir) {
      if (dir === 2) return `${col - 1},${row},h`;
      if (dir === 3) return `${col},${row - 1},v`;
      return `${col},${row},${dir === 0 ? "h" : "v"}`;
    }

    generate() {
      const { cols, rows } = this.grid;
      const taken = new Set();
      const isFree = (c, r) => c < cols - 1 && r < rows - 1 && !taken.has(`${c},${r}`);

      for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols - 1; col++) {
          if (!isFree(col, row)) continue;
          const { width, height } = this.pickBlockSize(col, row, isFree);
          for (let i = 0; i < width; i++) for (let j = 0; j < height; j++) taken.add(`${col + i},${row + j}`);
          this.blocks.push({ col, row, width, height });
          this.closeInnerEdges(col, row, width, height);
        }
      }
    }

    pickBlockSize(col, row, isFree) {
      const roll = Math.random();
      const canWiden = isFree(col + 1, row);
      const canDeepen = isFree(col, row + 1);
      if (roll < 0.22 && canWiden) return { width: 2, height: 1 };
      if (roll < 0.40 && canDeepen) return { width: 1, height: 2 };
      if (roll < 0.48 && canWiden && canDeepen && isFree(col + 1, row + 1)) return { width: 2, height: 2 };
      return { width: 1, height: 1 };
    }

    closeInnerEdges(col, row, width, height) {
      for (let i = 1; i < width; i++) for (let j = 0; j < height; j++) this.closedEdges.add(Maze.edgeKey(col + i, row + j, 1));
      for (let j = 1; j < height; j++) for (let i = 0; i < width; i++) this.closedEdges.add(Maze.edgeKey(col + i, row + j, 0));
    }

    canMove(col, row, dir) {
      const { dx, dy } = DIRECTIONS[dir];
      return this.grid.contains(col + dx, row + dy) && !this.closedEdges.has(Maze.edgeKey(col, row, dir));
    }

    openDirections(col, row) {
      return [0, 1, 2, 3].filter((dir) => this.canMove(col, row, dir));
    }

    /** Draws the walls once onto an off-screen canvas. */
    render(width, height) {
      const layer = document.createElement("canvas");
      const ctx = fitCanvas(layer, width, height);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      theme.gradient.forEach((color, i) => gradient.addColorStop(i / 2, color));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.28;

      const { cellSize } = this.grid;
      const inset = CONFIG.wallInset;
      for (const block of this.blocks) {
        ctx.beginPath();
        ctx.roundRect(
          this.grid.x(block.col) + inset,
          this.grid.y(block.row) + inset,
          block.width * cellSize - inset * 2,
          block.height * cellSize - inset * 2,
          7,
        );
        ctx.stroke();
      }
      return layer;
    }
  }

  // ── Pellets ─────────────────────────────────────────────────
  // Pellets sit on grid nodes and halfway along open corridors, so
  // positions are stored in half-cell units: key "hx,hy".
  const PELLET = { NORMAL: 1, POWER: 2 };

  class Pellets {
    constructor(maze) {
      this.maze = maze;
      this.grid = maze.grid;
      this.items = new Map();
      this.initialCount = 0;
      this.refill();
    }

    refill() {
      const { cols, rows } = this.grid;
      const maybeAdd = (hx, hy) => {
        if (Math.random() < CONFIG.pelletChance) this.items.set(`${hx},${hy}`, PELLET.NORMAL);
      };
      this.items.clear();
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          maybeAdd(col * 2, row * 2);
          if (this.maze.canMove(col, row, 0)) maybeAdd(col * 2 + 1, row * 2);
          if (this.maze.canMove(col, row, 1)) maybeAdd(col * 2, row * 2 + 1);
        }
      }
      for (let i = 0; i < CONFIG.powerPelletCount; i++) {
        this.items.set(`${randomInt(cols) * 2},${randomInt(rows) * 2}`, PELLET.POWER);
      }
      this.initialCount = this.items.size;
    }

    toPixel(hx, hy) {
      return { x: this.grid.offsetX + (hx * this.grid.cellSize) / 2, y: this.grid.offsetY + (hy * this.grid.cellSize) / 2 };
    }

    parseKey(key) {
      const [hx, hy] = key.split(",").map(Number);
      return this.toPixel(hx, hy);
    }

    /** Removes and returns the pellet under (x, y), or null. */
    eatAt(x, y) {
      const hx = Math.round(((x - this.grid.offsetX) / this.grid.cellSize) * 2);
      const hy = Math.round(((y - this.grid.offsetY) / this.grid.cellSize) * 2);
      const key = `${hx},${hy}`;
      const type = this.items.get(key);
      if (!type) return null;
      const pellet = this.toPixel(hx, hy);
      if (Math.abs(pellet.x - x) + Math.abs(pellet.y - y) > 10) return null;

      this.items.delete(key);
      if (this.items.size < this.initialCount * CONFIG.refillWhenBelow) this.refill();
      return type;
    }

    /** Nearest pellet to (x, y); power pellets count as a bit closer. */
    nearest(x, y) {
      let best = null;
      let bestScore = Infinity;
      for (const [key, type] of this.items) {
        const p = this.parseKey(key);
        const score = (p.x - x) ** 2 + (p.y - y) ** 2 - (type === PELLET.POWER ? 40000 : 0);
        if (score < bestScore) { bestScore = score; best = { key, ...p }; }
      }
      return best;
    }

    has(key) { return this.items.has(key); }

    draw(ctx, time) {
      const powerVisible = Math.floor(time * 3) % 2 === 0; // power pellets blink
      for (const [key, type] of this.items) {
        const { x, y } = this.parseKey(key);
        if (type === PELLET.NORMAL) {
          ctx.fillStyle = COLORS.pellet;
          ctx.fillRect(x - 2, y - 2, 4, 4);
        } else if (powerVisible) {
          ctx.fillStyle = theme.gradient[1];
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ── Actor ───────────────────────────────────────────────────
  // Moves along corridors one grid step at a time. At every node it
  // asks its `chooseDirection` callback where to go next.
  class Actor {
    constructor(col, row, chooseDirection) {
      this.chooseDirection = chooseDirection;
      this.placeAt(col, row);
    }

    placeAt(col, row) {
      this.from = { col, row };
      this.to = { col, row };
      this.progress = 0;   // 0 at `from`, 1 at `to`
      this.dir = 0;
      this.moving = false;
    }

    position(grid) {
      const col = this.from.col + (this.to.col - this.from.col) * this.progress;
      const row = this.from.row + (this.to.row - this.from.row) * this.progress;
      return { x: grid.x(col), y: grid.y(row) };
    }

    pickNextStep(maze) {
      const options = maze.openDirections(this.from.col, this.from.row);
      const dir = this.chooseDirection(this, options);
      if (dir == null) {
        this.moving = false;
        this.to = { ...this.from };
        return;
      }
      this.dir = dir;
      this.to = { col: this.from.col + DIRECTIONS[dir].dx, row: this.from.row + DIRECTIONS[dir].dy };
      this.moving = true;
    }

    update(dt, speed, maze) {
      if (!this.moving) {
        this.pickNextStep(maze);
        if (!this.moving) return;
      }
      this.progress += speed * dt;
      while (this.progress >= 1) {
        this.from = { ...this.to };
        this.progress -= 1;
        this.pickNextStep(maze);
        if (!this.moving) { this.progress = 0; break; }
      }
    }

    turnAround() {
      [this.from, this.to] = [this.to, this.from];
      this.progress = 1 - this.progress;
      this.dir = opposite(this.dir);
    }
  }

  // ── Game ────────────────────────────────────────────────────
  class PacmanBackground {
    constructor(canvas) {
      this.canvas = canvas;
      this.mouse = { x: -1e4, y: -1e4 };
      this.time = 0;
      this.frightenedTimeLeft = 0;
      this.ghostsEatenInARow = 0;
      this.popups = [];   // floating score text
      this.sparks = [];   // particles when a ghost is eaten
      this.nextLogoIndex = 0;
      this.loop = createLoop((dt) => { this.update(dt); this.draw(); });

      window.addEventListener("pointermove", (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; }, { passive: true });
      onResizeEnd(() => this.reset());
      this.reset();
    }

    start() {
      if (prefersReducedMotion) this.draw();
      else this.loop.start();
    }

    reset() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.ctx = fitCanvas(this.canvas, this.width, this.height);
      this.grid = new Grid(this.width, this.height, CONFIG.cellSize);
      this.maze = new Maze(this.grid);
      this.wallLayer = this.maze.render(this.width, this.height);
      this.pellets = new Pellets(this.maze);
      this.vignette = this.createVignette();
      this.spawnActors();
      if (prefersReducedMotion) this.draw();
    }

    // Fades the middle of the screen so page text stays readable.
    createVignette() {
      const cx = this.width / 2, cy = this.height * 0.42;
      const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(this.width, this.height) * 0.6);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.7)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      return gradient;
    }

    nextLogo() {
      const logo = logos[this.nextLogoIndex % logos.length];
      this.nextLogoIndex++;
      return logo;
    }

    spawnActors() {
      const { center, cols, rows } = this.grid;
      this.pacmanStart = { col: center.col, row: Math.min(rows - 1, center.row + 2) };
      this.pacman = new Actor(this.pacmanStart.col, this.pacmanStart.row, (actor, options) => this.choosePacmanDirection(actor, options));
      this.pacman.deathTimer = 0;

      const ghostCount = Math.max(3, Math.min(6, Math.round((cols * rows) / 70)));
      const corners = [{ x: 0, y: 0 }, { x: this.width, y: 0 }, { x: 0, y: this.height }, { x: this.width, y: this.height }];
      this.ghosts = Array.from({ length: logos.length ? ghostCount : 0 }, (_, i) => {
        const ghost = new Actor(randomInt(cols), i % 2 ? 0 : rows - 1, (actor, options) => this.chooseGhostDirection(actor, options));
        ghost.state = GHOST_STATE.CHASE;
        ghost.personality = PERSONALITIES[i % PERSONALITIES.length];
        ghost.corner = corners[i % corners.length];
        ghost.home = center;
        ghost.logo = this.nextLogo();
        ghost.speedFactor = random(0.9, 1.05);
        return ghost;
      });
    }

    // ── Steering ──────────────────────────────────────────────
    /**
     * Picks the open direction that moves closest to (or, when
     * fleeing, furthest from) a target. U-turns are avoided unless
     * there's no other way. `randomness` is the chance of a random pick.
     */
    steer(actor, options, target, { flee = false, randomness = 0.15 } = {}) {
      const forward = options.filter((dir) => dir !== opposite(actor.dir));
      const choices = forward.length ? forward : options;
      if (!choices.length) return null;
      if (Math.random() < randomness) return randomItem(choices);

      const distanceAfter = (dir) => {
        const x = this.grid.x(actor.from.col + DIRECTIONS[dir].dx);
        const y = this.grid.y(actor.from.row + DIRECTIONS[dir].dy);
        return (x - target.x) ** 2 + (y - target.y) ** 2;
      };
      return choices.reduce((best, dir) => {
        const better = flee ? distanceAfter(dir) > distanceAfter(best) : distanceAfter(dir) < distanceAfter(best);
        return better ? dir : best;
      });
    }

    nearestGhost(point, state) {
      let nearest = null;
      let nearestDistance = Infinity;
      for (const ghost of this.ghosts) {
        if (ghost.state !== state) continue;
        const p = ghost.position(this.grid);
        const distance = Math.hypot(p.x - point.x, p.y - point.y);
        if (distance < nearestDistance) { nearestDistance = distance; nearest = { ghost, position: p, distance }; }
      }
      return nearest;
    }

    choosePacmanDirection(pacman, options) {
      if (pacman.deathTimer > 0) return null;
      const here = { x: this.grid.x(pacman.from.col), y: this.grid.y(pacman.from.row) };

      const threat = this.nearestGhost(here, GHOST_STATE.CHASE);
      if (threat && threat.distance < this.grid.cellSize * 2.2) {
        return this.steer(pacman, options, threat.position, { flee: true, randomness: 0 });
      }

      const prey = this.frightenedTimeLeft > 0 && this.nearestGhost(here, GHOST_STATE.FRIGHTENED);
      if (prey) return this.steer(pacman, options, prey.position, { randomness: 0.05 });

      if (!this.pelletTarget || !this.pellets.has(this.pelletTarget.key)) {
        this.pelletTarget = this.pellets.nearest(here.x, here.y);
      }
      const target = this.pelletTarget || { x: this.width / 2, y: this.height / 2 };
      return this.steer(pacman, options, target, { randomness: 0.08 });
    }

    chooseGhostDirection(ghost, options) {
      const here = { x: this.grid.x(ghost.from.col), y: this.grid.y(ghost.from.row) };

      if (ghost.state === GHOST_STATE.RETURNING) {
        const atHome = ghost.from.col === ghost.home.col && ghost.from.row === ghost.home.row;
        if (!atHome) return this.steer(ghost, options, { x: this.grid.x(ghost.home.col), y: this.grid.y(ghost.home.row) }, { randomness: 0.02 });
        ghost.state = GHOST_STATE.CHASE;   // back home: revive with a new logo
        ghost.logo = this.nextLogo();
      }

      if (Math.hypot(this.mouse.x - here.x, this.mouse.y - here.y) < CONFIG.mouseScareRadius) {
        return this.steer(ghost, options, this.mouse, { flee: true, randomness: 0 });
      }

      const pacman = this.pacman.position(this.grid);
      if (ghost.state === GHOST_STATE.FRIGHTENED) return this.steer(ghost, options, pacman, { flee: true, randomness: 0.25 });

      switch (ghost.personality) {
        case "chaser":
          return this.steer(ghost, options, pacman, { randomness: 0.12 });
        case "ambusher": {
          const ahead = DIRECTIONS[this.pacman.dir];
          const lookAhead = this.grid.cellSize * 4;
          return this.steer(ghost, options, { x: pacman.x + ahead.dx * lookAhead, y: pacman.y + ahead.dy * lookAhead });
        }
        case "patroller":
          return this.steer(ghost, options, ghost.corner, { randomness: 0.3 });
        default:
          return this.steer(ghost, options, pacman, { randomness: 0.55 });
      }
    }

    // ── Update ────────────────────────────────────────────────
    update(dt) {
      this.time += dt;
      this.updateFrightenedTimer(dt);
      this.updatePacman(dt);
      this.updateGhosts(dt);
      this.handleCollisions();
      this.updateEffects(dt);
    }

    updateFrightenedTimer(dt) {
      if (this.frightenedTimeLeft <= 0) return;
      this.frightenedTimeLeft -= dt;
      if (this.frightenedTimeLeft > 0) return;
      for (const ghost of this.ghosts) if (ghost.state === GHOST_STATE.FRIGHTENED) ghost.state = GHOST_STATE.CHASE;
    }

    updatePacman(dt) {
      const pacman = this.pacman;
      if (pacman.deathTimer > 0) {
        pacman.deathTimer -= dt;
        if (pacman.deathTimer <= 0) this.respawn();
        return;
      }
      pacman.update(dt, CONFIG.speed.pacman, this.maze);

      const { x, y } = pacman.position(this.grid);
      const eaten = this.pellets.eatAt(x, y);
      if (eaten === PELLET.POWER) this.frightenGhosts();
    }

    frightenGhosts() {
      this.frightenedTimeLeft = CONFIG.frightenedSeconds;
      this.ghostsEatenInARow = 0;
      for (const ghost of this.ghosts) {
        if (ghost.state !== GHOST_STATE.CHASE) continue;
        ghost.state = GHOST_STATE.FRIGHTENED;
        ghost.turnAround();
      }
    }

    updateGhosts(dt) {
      const pacmanDying = this.pacman.deathTimer > 0;
      for (const ghost of this.ghosts) {
        if (pacmanDying && ghost.state !== GHOST_STATE.RETURNING) continue;
        const speed = ghost.state === GHOST_STATE.RETURNING ? CONFIG.speed.returning
          : ghost.state === GHOST_STATE.FRIGHTENED ? CONFIG.speed.frightened
          : CONFIG.speed.ghost * ghost.speedFactor;
        ghost.update(dt, speed, this.maze);
      }
    }

    handleCollisions() {
      if (this.pacman.deathTimer > 0) return;
      const pacman = this.pacman.position(this.grid);
      const touchDistance = this.grid.cellSize * 0.45;

      for (const ghost of this.ghosts) {
        const p = ghost.position(this.grid);
        if (Math.hypot(p.x - pacman.x, p.y - pacman.y) > touchDistance) continue;

        if (ghost.state === GHOST_STATE.FRIGHTENED) {
          this.ghostsEatenInARow++;
          this.popups.push({ x: p.x, y: p.y, text: String(100 * 2 ** this.ghostsEatenInARow), life: 1.1 });
          this.addSparks(p.x, p.y, ghost.logo.color);
          ghost.state = GHOST_STATE.RETURNING;
        } else if (ghost.state === GHOST_STATE.CHASE) {
          this.pacman.deathTimer = CONFIG.deathSeconds;
          this.pacman.moving = false;
          return;
        }
      }
    }

    respawn() {
      const { cols, rows } = this.grid;
      this.pacman.placeAt(this.pacmanStart.col, this.pacmanStart.row);
      for (const ghost of this.ghosts) {
        ghost.placeAt(randomInt(cols), Math.random() < 0.5 ? 0 : rows - 1);
        if (ghost.state !== GHOST_STATE.RETURNING) ghost.state = GHOST_STATE.CHASE;
      }
    }

    addSparks(x, y, color) {
      const count = 14;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = random(60, 160);
        this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: random(0.4, 0.8), color });
      }
    }

    updateEffects(dt) {
      for (const p of this.popups) { p.life -= dt; p.y -= 24 * dt; }
      for (const s of this.sparks) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; }
      this.popups = this.popups.filter((p) => p.life > 0);
      this.sparks = this.sparks.filter((s) => s.life > 0);
    }

    // ── Drawing ───────────────────────────────────────────────
    draw() {
      const { ctx } = this;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.drawImage(this.wallLayer, 0, 0, this.width, this.height);
      this.pellets.draw(ctx, this.time);
      this.ghosts.forEach((ghost) => this.drawGhost(ghost));
      this.drawPacman();
      this.drawEffects();

      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalCompositeOperation = "source-over";
    }

    drawPacman() {
      const { ctx } = this;
      const { x, y } = this.pacman.position(this.grid);
      const radius = this.grid.cellSize * 0.34;

      // Mouth half-angle: chomps while moving; when dying it opens
      // all the way until Pac-Man disappears.
      let mouth;
      let rotation;
      if (this.pacman.deathTimer > 0) {
        const remaining = Math.max(0, this.pacman.deathTimer - 0.2) / (CONFIG.deathSeconds - 0.2);
        if (remaining <= 0) return;
        mouth = Math.PI * (1 - remaining);
        rotation = -Math.PI / 2;
      } else {
        const chomp = this.pacman.moving ? Math.abs(Math.sin(this.time * 14)) : 0.4;
        mouth = chomp * 0.32 * Math.PI;
        rotation = (this.pacman.dir * Math.PI) / 2;
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      const fill = ctx.createLinearGradient(-radius, -radius, radius, radius);
      fill.addColorStop(0, COLORS.pacmanTop);
      fill.addColorStop(1, theme.gradient[2]);
      ctx.fillStyle = fill;
      ctx.shadowColor = theme.gradient[2];
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, mouth, Math.PI * 2 - mouth);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /**
     * Ghosts are rounded squares in the logo's brand colour with the
     * logo inside. Frightened ghosts turn blue (flashing white near the
     * end); eaten ghosts show as a faint outline on their way home.
     */
    drawGhost(ghost) {
      const { ctx } = this;
      const { x, y } = ghost.position(this.grid);
      const size = this.grid.cellSize * 0.66;
      const corner = size * 0.26;
      const left = x - size / 2;
      const top = y - size / 2;

      ctx.beginPath();
      ctx.roundRect(left, top, size, size, corner);

      if (ghost.state === GHOST_STATE.RETURNING) {
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = hexToRgba(ghost.logo.color, 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      const frightened = ghost.state === GHOST_STATE.FRIGHTENED;
      const flashing = frightened && this.frightenedTimeLeft < 2 && Math.floor(this.time * 6) % 2 === 0;
      const borderColor = frightened ? (flashing ? COLORS.frightenedFlash : COLORS.frightened) : ghost.logo.color;
      const logoColor = frightened ? (flashing ? COLORS.frightened : COLORS.frightenedFlash) : ghost.logo.color;

      ctx.fillStyle = frightened ? borderColor : hexToRgba(ghost.logo.color, 0.16);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = borderColor;
      ctx.stroke();
      drawLogo(ctx, ghost.logo, x, y, size * 0.56, logoColor);
    }

    drawEffects() {
      const { ctx } = this;
      for (const s of this.sparks) {
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
      }
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.score;
      for (const p of this.popups) {
        ctx.globalAlpha = Math.min(1, p.life * 1.5);
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    }
  }

  const canvas = $("#pacman-bg");
  if (canvas) new PacmanBackground(canvas).start();
})();
