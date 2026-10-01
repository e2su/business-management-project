/**
 * Builds each page section from the content in js/content.js.
 * Every function here only renders HTML; behaviour lives in
 * effects.js, hero.js and the other scripts.
 */
window.App.sections = (() => {
  "use strict";
  const { $, $$, escapeHtml: esc, linkTargetAttrs, logos, logoSvg } = window.App;

  const ICONS = {
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    flow: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 6h4a3 3 0 0 1 3 3v6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    code: '<path d="M8 6l-6 6 6 6"/><path d="M16 6l6 6-6 6"/><path d="M14 4l-4 16"/>',
    cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/>',
  };

  /** Inline style that staggers reveal animations within a group. */
  const stagger = (index, stepMs = 70) => `transition-delay: ${index * stepMs}ms`;
  const initials = (name) => name.split(" ").map((word) => word[0]).join("");

  function renderIdentity(content) {
    $$("[data-name]").forEach((el) => (el.textContent = content.name));
    $$("[data-initials]").forEach((el) => (el.textContent = content.initials));
    $("#hero-intro").textContent = content.intro;
    $("#year").textContent = new Date().getFullYear();
    document.title = `${content.name} — ${content.role}`;
  }

  function renderLogoMarquee() {
    const items = logos
      .map((logo) => `<span class="marquee-item" style="--brand: ${logo.color}">${logoSvg(logo)}${esc(logo.title)}</span>`)
      .join("");
    // The list is repeated so the CSS animation can loop seamlessly.
    $("#marquee").innerHTML = items + items;
  }

  function renderStats(stats) {
    $("#stats").innerHTML = stats
      .map((stat) => `
        <div class="card stat">
          <b data-count="${stat.value}" data-suffix="${esc(stat.suffix)}">0${esc(stat.suffix)}</b>
          <span>${esc(stat.label)}</span>
        </div>`)
      .join("");
  }

  function renderServices(services) {
    $("#services-grid").innerHTML = services
      .map((service, i) => `
        <article class="card service reveal ${service.size ?? ""}" style="${stagger(i, 60)}">
          <span class="service-number">0${i + 1}</span>
          <div class="service-icon"><svg viewBox="0 0 24 24">${ICONS[service.icon] ?? ICONS.code}</svg></div>
          <h3>${esc(service.title)}</h3>
          <p>${esc(service.text)}</p>
        </article>`)
      .join("");
  }

  function renderProjects(projects) {
    const categories = ["All", ...new Set(projects.map((p) => p.category))];
    $("#project-filters").innerHTML = categories
      .map((category, i) => `
        <button class="filter ${i === 0 ? "active" : ""}" role="tab" aria-selected="${i === 0}" data-category="${esc(category)}">
          ${esc(category)}
        </button>`)
      .join("");

    $("#projects-grid").innerHTML = projects
      .map((project, i) => `
        <a class="card project reveal" href="${esc(project.url)}" ${linkTargetAttrs(project.url)}
           data-category="${esc(project.category)}" style="${stagger(i % 3)}">
          <div class="project-thumb">
            <canvas data-project-index="${i}"></canvas>
            <span class="project-label">${esc(project.category.toUpperCase())} · ${esc(project.year)}</span>
          </div>
          <div class="project-body">
            <h3>${esc(project.title)}<span class="project-arrow" aria-hidden="true">↗</span></h3>
            <p>${esc(project.text)}</p>
            <div class="tags">${project.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
          </div>
        </a>`)
      .join("");
  }

  function renderProcess(steps) {
    $("#process-steps").innerHTML = steps
      .map((step, i) => `
        <article class="card step reveal" style="${stagger(i, 90)}; --progress: ${((i + 1) / steps.length) * 100}%">
          <span class="step-number">${esc(step.step)}</span>
          <h3>${esc(step.title)}</h3>
          <p>${esc(step.text)}</p>
          <div class="step-track"><i></i></div>
        </article>`)
      .join("");
  }

  function renderTestimonials(testimonials) {
    $("#testimonials-grid").innerHTML = testimonials
      .map((t, i) => `
        <figure class="card testimonial reveal" style="${stagger(i, 90)}">
          <div class="stars" aria-label="5 stars">★★★★★</div>
          <blockquote>“${esc(t.quote)}”</blockquote>
          <figcaption class="author">
            <span class="avatar">${esc(initials(t.name))}</span>
            <div><b>${esc(t.name)}</b><span>${esc(t.role)}</span></div>
          </figcaption>
        </figure>`)
      .join("");
  }

  function renderFaq(questions) {
    $("#faq-list").innerHTML = questions
      .map((item, i) => `
        <details class="reveal" ${i === 0 ? "open" : ""}>
          <summary>${esc(item.q)}</summary>
          <div class="faq-answer">${esc(item.a)}</div>
        </details>`)
      .join("");
  }

  function renderSocials(socials) {
    $("#socials").innerHTML = socials
      .map((s) => `<a href="${esc(s.url)}" ${linkTargetAttrs(s.url)}>${esc(s.label)}</a>`)
      .join("");
  }

  function renderAll(content) {
    renderIdentity(content);
    renderLogoMarquee();
    renderStats(content.stats);
    renderServices(content.services);
    renderProjects(content.projects);
    renderProcess(content.process);
    renderTestimonials(content.testimonials);
    renderFaq(content.faq);
    renderSocials(content.socials);
  }

  return { renderAll };
})();
