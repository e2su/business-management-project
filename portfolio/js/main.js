// Renders content from data.js and wires up all interactions.
(() => {
  "use strict";
  const D = window.PORTFOLIO;
  const A = window.ARCADE || {};
  const LOGOS = A.LOGOS || [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const logoByTitle = (t) => LOGOS.find((l) => l.title.toLowerCase() === t.toLowerCase());
  const logoSvg = (l) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${l.path}"/></svg>`;

  // ── Basic text ──────────────────────────────────────────────
  $$("[data-name]").forEach((el) => (el.textContent = D.name));
  $$("[data-initials]").forEach((el) => (el.textContent = D.initials));
  $("#hero-intro").textContent = D.intro;
  $("#year").textContent = new Date().getFullYear();
  document.title = `${D.name} — ${D.role}`;

  // Hero headline, word by word
  let wi = 0;
  $("#hero-title").innerHTML = D.headline
    .map((line, li) =>
      `<span class="line">${line
        .split(" ")
        .map((w) => `<span class="word${li === D.headline.length - 1 ? " grad-text" : ""}" style="animation-delay:${0.15 + wi++ * 0.08}s">${esc(w)}</span>`)
        .join(" ")}</span>`)
    .join("");

  // Typed roles
  (function typeLoop() {
    const el = $("#typed");
    if (reduced) { el.textContent = D.roles[0]; return; }
    let r = 0, i = 0, del = false;
    (function tick() {
      const word = D.roles[r];
      el.textContent = word.slice(0, i);
      if (!del && i === word.length) { del = true; return setTimeout(tick, 1600); }
      if (del && i === 0) { del = false; r = (r + 1) % D.roles.length; }
      i += del ? -1 : 1;
      setTimeout(tick, del ? 40 : 80);
    })();
  })();

  // ── Mockup chart ────────────────────────────────────────────
  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const bars = $("#bars");
  bars.innerHTML = months.map((m) => `<div class="bar" data-v="${m}"></div>`).join("");
  const randomiseBars = () =>
    $$(".bar", bars).forEach((b, i) => {
      const v = Math.round(25 + 60 * (0.5 + 0.5 * Math.sin(i / 2 + Math.random())) + Math.random() * 15);
      b.style.height = `${Math.min(100, v)}%`;
      b.dataset.v = `${months[i]} · ${v}k`;
    });

  // ── Marquee + chips ─────────────────────────────────────────
  const mq = LOGOS.map((l) => `<span class="mq-item" style="--c:${l.color}">${logoSvg(l)}${esc(l.title)}</span>`).join("");
  $("#marquee").innerHTML = mq + mq;
  $("#chips").innerHTML = LOGOS.map((l) => `<span class="chip" style="--c:${l.color}">${logoSvg(l)}${esc(l.title)}</span>`).join("");

  // ── Stats ───────────────────────────────────────────────────
  $("#stats").innerHTML = D.stats
    .map((s) => `<div class="stat card"><b data-count="${s.value}" data-suffix="${esc(s.suffix)}">0${esc(s.suffix)}</b><span>${esc(s.label)}</span></div>`)
    .join("");

  // ── Services bento ──────────────────────────────────────────
  const ICONS = {
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    flow: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 6h4a3 3 0 0 1 3 3v6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    code: '<path d="M8 6l-6 6 6 6"/><path d="M16 6l6 6-6 6"/><path d="M14 4l-4 16"/>',
    cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/>',
  };
  $("#bento").innerHTML = D.services
    .map((s, i) => `
      <article class="card reveal ${s.size || ""}" style="transition-delay:${i * 60}ms">
        <span class="pix-badge">0${i + 1}</span>
        <div class="icon"><svg viewBox="0 0 24 24">${ICONS[s.icon] || ICONS.code}</svg></div>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.text)}</p>
      </article>`)
    .join("");

  // ── Projects ────────────────────────────────────────────────
  const cats = ["All", ...new Set(D.projects.map((p) => p.category))];
  $("#filters").innerHTML = cats
    .map((c, i) => `<button class="filter${i ? "" : " active"}" role="tab" aria-selected="${!i}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join("");
  $("#projects").innerHTML = D.projects
    .map((p, i) => `
      <a class="card project reveal" href="${esc(p.url)}" ${p.url.startsWith("http") ? 'target="_blank" rel="noopener"' : ""} data-cat="${esc(p.category)}" style="transition-delay:${(i % 3) * 70}ms">
        <div class="thumb"><canvas data-i="${i}"></canvas><span class="pix">${esc(p.category.toUpperCase())} · ${esc(p.year)}</span></div>
        <div class="project-body">
          <h3>${esc(p.title)}<span class="arrow" aria-hidden="true">↗</span></h3>
          <p>${esc(p.text)}</p>
          <div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
        </div>
      </a>`)
    .join("");

  $("#filters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;
    $$(".filter").forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", b === btn); });
    const cat = btn.dataset.cat;
    $$(".project").forEach((p) => {
      const show = cat === "All" || p.dataset.cat === cat;
      p.classList.toggle("hide", !show);
      p.classList.remove("pop");
      if (show) { void p.offsetWidth; p.classList.add("pop", "in"); }
    });
  });

  // Project thumbnails: a little Space-Invaders formation built
  // from the project's own tech logos. They march on hover.
  const INVADER = ["..a.....a..", "...a...a...", "..aaaaaaa..", ".aa.aaa.aa.", "aaaaaaaaaaa", "a.aaaaaaa.a", "a.a.....a.a", "...aa.aa..."];
  $$(".thumb canvas").forEach((cv) => {
    const p = D.projects[+cv.dataset.i];
    const logos = p.tags.map(logoByTitle).filter(Boolean);
    const ctx = cv.getContext("2d");
    const card = cv.closest(".project");
    let t = 0, raf = 0, last = 0;
    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, w, h);
      const c1 = A.G ? A.G[p.accent % 3] : "#7c3aed", c2 = A.G ? A.G[(p.accent + 1) % 3] : "#ec4899";
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = "#07070a"; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.22; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
      // ground line + stars
      ctx.fillStyle = "rgba(255,255,255,.35)";
      for (let i = 0; i < 24; i++) ctx.fillRect((i * 53.7 + t * 6) % w, (i * 31.3) % (h - 40), 1.5, 1.5);
      // invader
      const px = 5, ix = w / 2 - (INVADER[0].length * px) / 2 + Math.sin(t * 2) * 20, iy = 26 + Math.floor(t * 2) % 2;
      ctx.fillStyle = g;
      INVADER.forEach((row, j) => [...row].forEach((ch, i) => ch === "a" && ctx.fillRect(ix + i * px, iy + j * px, px, px)));
      // logo row marching
      const n = logos.length, sp = 54, row = (n - 1) * sp;
      logos.forEach((l, i) => {
        const x = w / 2 - row / 2 + i * sp + Math.sin(t * 1.5) * 16, y = h - 52 + (Math.floor(t * 4 + i) % 2) * 3;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
        if (A.drawLogo) A.drawLogo(ctx, l, x, y, 22);
      });
      // player cannon
      ctx.fillStyle = "#4ade80";
      const cx = w / 2 + Math.sin(t * 3) * (w / 3);
      ctx.fillRect(cx - 9, h - 10, 18, 5); ctx.fillRect(cx - 2, h - 15, 4, 5);
    };
    const loop = (ts) => { t += Math.min(0.05, (ts - last) / 1000 || 0); last = ts; draw(); raf = requestAnimationFrame(loop); };
    draw();
    if (!reduced) {
      card.addEventListener("pointerenter", () => { last = performance.now(); raf = requestAnimationFrame(loop); });
      card.addEventListener("pointerleave", () => cancelAnimationFrame(raf));
    }
    new ResizeObserver(() => draw()).observe(cv);
  });

  // ── Steps / testimonials / FAQ / socials ────────────────────
  $("#steps").innerHTML = D.process
    .map((s, i) => `
      <article class="card step reveal" style="transition-delay:${i * 90}ms; --w:${(i + 1) * 33.4}%">
        <span class="num">${esc(s.step)}</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.text)}</p>
        <div class="track"><i></i></div>
      </article>`)
    .join("");
  $("#quotes").innerHTML = D.testimonials
    .map((q, i) => `
      <figure class="card quote reveal" style="margin:0; transition-delay:${i * 90}ms">
        <div class="stars" aria-label="5 stars">★★★★★</div>
        <blockquote>“${esc(q.quote)}”</blockquote>
        <figcaption class="who"><span class="avatar">${esc(q.name.split(" ").map((w) => w[0]).join(""))}</span><div><b>${esc(q.name)}</b><span>${esc(q.role)}</span></div></figcaption>
      </figure>`)
    .join("");
  $("#faq-list").innerHTML = D.faq
    .map((f, i) => `<details class="reveal" ${i ? "" : "open"}><summary>${esc(f.q)}</summary><div class="ans">${esc(f.a)}</div></details>`)
    .join("");
  // accordion: only one open at a time
  $$("#faq-list details").forEach((d) => d.addEventListener("toggle", () => {
    if (d.open) $$("#faq-list details").forEach((o) => o !== d && (o.open = false));
  }));
  $("#socials").innerHTML = D.socials.map((s) => `<a href="${esc(s.url)}" ${s.url.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${esc(s.label)}</a>`).join("");

  // ── Count-up numbers ────────────────────────────────────────
  function countUp(el) {
    const end = +el.dataset.count, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    const fmt = (n) => pre + Math.round(n).toLocaleString() + suf;
    if (reduced) { el.textContent = fmt(end); return; }
    const t0 = performance.now(), dur = 1600;
    (function f(now) {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  // ── Reveal on scroll ────────────────────────────────────────
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      $$("[data-count]", e.target).forEach(countUp);
      if (e.target.id === "mockup") { randomiseBars(); setInterval(() => !document.hidden && randomiseBars(), 3500); }
      io.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  // ── Card spotlight + tilt ───────────────────────────────────
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest && e.target.closest(".card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--x", `${e.clientX - r.left}px`);
    card.style.setProperty("--y", `${e.clientY - r.top}px`);
  }, { passive: true });
  if (!reduced && matchMedia("(hover: hover)").matches) {
    $$(".project").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
      });
      card.addEventListener("pointerleave", () => (card.style.transform = ""));
    });
  }

  // ── Cursor glow ─────────────────────────────────────────────
  const glow = $(".cursor-glow");
  let gx = -999, gy = -999, tx = gx, ty = gy;
  window.addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  (function follow() {
    gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
    glow.style.setProperty("--mx", `${gx}px`);
    glow.style.setProperty("--my", `${gy}px`);
    requestAnimationFrame(follow);
  })();

  // ── Nav: scrolled state, active link, mobile menu ───────────
  const nav = $("#nav"), mockup = $("#mockup");
  const onScroll = () => {
    nav.classList.toggle("scrolled", scrollY > 20);
    // hero mockup flattens as you scroll (like the template's product shot)
    const k = Math.min(1, scrollY / 500);
    mockup.style.setProperty("--rx", `${14 * (1 - k)}deg`);
    mockup.style.setProperty("--sc", `${0.94 + 0.06 * k}`);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const links = $$(".nav-links a");
  const secIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.forEach((a) => { const s = $(a.getAttribute("href")); if (s) secIO.observe(s); });

  const menuBtn = $("#menu-btn"), navLinks = $("#nav-links");
  menuBtn.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
  });
  links.forEach((a) => a.addEventListener("click", () => { navLinks.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false); }));

  // ── Play mode (Pac-Man background) ──────────────────────────
  $("#play-btn").addEventListener("click", () => A.setPlaying && A.setPlaying(true));
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kpos = 0;
  window.addEventListener("keydown", (e) => {
    if (A.isPlaying && A.isPlaying()) return;
    kpos = e.key === KONAMI[kpos] ? kpos + 1 : e.key === KONAMI[0] ? 1 : 0;
    if (kpos === KONAMI.length) { kpos = 0; A.setPlaying && A.setPlaying(true); }
  });

  // ── Contact form → opens the visitor's mail client ──────────
  const form = $("#contact-form"), status = $("#form-status");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    $$("input, textarea", form).forEach((f) => {
      const bad = !f.value.trim() || (f.type === "email" && !/^\S+@\S+\.\S+$/.test(f.value));
      f.closest(".field").classList.toggle("invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) { status.textContent = "Please fill in every field with a valid email."; return; }
    const data = Object.fromEntries(new FormData(form));
    const body = `${data.message}\n\n— ${data.name} (${data.email})`;
    window.location.href = `mailto:${D.email}?subject=${encodeURIComponent(`Project enquiry from ${data.name}`)}&body=${encodeURIComponent(body)}`;
    status.textContent = "Opening your email app… thanks! 🎮";
    form.reset();
  });
})();
