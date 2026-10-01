/**
 * Builds each page section from App.content (see js/i18n.js).
 * Every function here only renders HTML; behaviour lives in the
 * feature scripts (hero.js, projects.js, case-study.js, …).
 */
window.App.sections = (() => {
  "use strict";
  const { $, $$, escapeHtml: esc, linkTargetAttrs, logos, logoSvg } = window.App;

  const ICONS = {
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    flow: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 6h4a3 3 0 0 1 3 3v6"/>',
    code: '<path d="M8 6l-6 6 6 6"/><path d="M16 6l6 6-6 6"/><path d="M14 4l-4 16"/>',
    cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/>',
    brain: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  };

  /** Inline style that staggers reveal animations within a group. */
  const stagger = (index, stepMs = 70) => `transition-delay: ${index * stepMs}ms`;
  const youtubeThumbnail = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;

  function renderIdentity(content) {
    $$("[data-name]").forEach((el) => (el.textContent = content.name));
    $$("[data-initials]").forEach((el) => (el.textContent = content.initials));
    $("#hero-intro").textContent = content.intro;
    $("#about-text").textContent = content.about;
    $("#year").textContent = new Date().getFullYear();
    $("#footer-location").textContent = content.location;
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
          <b data-count="${stat.value}" data-decimals="${stat.decimals ?? 0}" data-suffix="${esc(stat.suffix ?? "")}">0</b>
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

  // ── Projects ────────────────────────────────────────────────
  /** Screenshot, video thumbnail or (if neither) a canvas for projects.js to draw on. */
  function projectThumb(project, index) {
    const media = project.media;
    if (media?.type === "image") {
      return `<img src="${esc(media.src)}" alt="" loading="lazy" />`;
    }
    if (media?.type === "youtube") {
      // if the thumbnail can't load, the gradient behind it still shows with the play button
      return `<img src="${youtubeThumbnail(media.id)}" alt="" loading="lazy" onerror="this.remove()" /><span class="play-badge" aria-hidden="true">▶</span>`;
    }
    return `<canvas data-project-index="${index}"></canvas>`;
  }

  function renderProjects(projects, t) {
    const categories = ["all", ...new Set(projects.map((p) => p.category))];
    $("#project-filters").innerHTML = categories
      .map((category, i) => `
        <button class="filter ${i === 0 ? "active" : ""}" role="tab" aria-selected="${i === 0}" data-category="${category}">
          ${esc(category === "all" ? t("work.all") : t(`work.category.${category}`))}
        </button>`)
      .join("");

    $("#projects-grid").innerHTML = projects
      .map((project, i) => `
        <article class="card project reveal" data-category="${project.category}" style="${stagger(i % 3)}">
          <div class="project-thumb">
            ${projectThumb(project, i)}
            <span class="project-label">${esc(t(`work.category.${project.category}`))} · ${esc(project.year)}</span>
          </div>
          <div class="project-body">
            <h3>${esc(project.title)}<span class="project-arrow" aria-hidden="true">↗</span></h3>
            <p>${esc(project.text)}</p>
            ${project.highlights?.length ? `<ul class="highlights">${project.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
            <div class="tags">${project.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
          </div>
          <!-- covers the whole card; opens the case study -->
          <button class="project-open" type="button" data-project-id="${project.id}">
            <span class="visually-hidden">${esc(t("work.caseStudy"))}: ${esc(project.title)}</span>
          </button>
        </article>`)
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

  function renderJourney(entries) {
    $("#timeline").innerHTML = entries
      .map((entry, i) => `
        <li class="timeline-item reveal" style="${stagger(i, 90)}">
          <span class="timeline-dot" aria-hidden="true"></span>
          <div class="card timeline-card">
            ${entry.period ? `<span class="timeline-period">${esc(entry.period)}</span>` : ""}
            <h3>${esc(entry.title)}</h3>
            <p class="timeline-place">${esc(entry.place)}</p>
            <p>${esc(entry.text)}</p>
          </div>
        </li>`)
      .join("");
  }

  function renderCertifications(certifications, languages, t) {
    const badge = (cert) =>
      cert.image
        ? `<img class="cert-badge cert-badge-image" src="${esc(cert.image)}" alt="" loading="lazy" />`
        : `<span class="cert-badge">${esc(cert.badge)}</span>`;
    const link = (cert) =>
      cert.url
        ? `<a class="cert-link" href="${esc(cert.url)}" target="_blank" rel="noopener">${esc(t("certs.view"))} <span aria-hidden="true">↗</span></a>`
        : "";

    $("#certs-grid").innerHTML = certifications
      .map((cert, i) => `
        <article class="card cert reveal" style="${stagger(i, 70)}">
          ${badge(cert)}
          <div>
            <h3>${esc(cert.title)}</h3>
            <p class="cert-issuer">${esc(cert.issuer)}</p>
            <p>${esc(cert.text)}</p>
            ${link(cert)}
          </div>
        </article>`)
      .join("");

    $("#languages").innerHTML = languages
      .map((language) => `<span class="language-chip"><b>${esc(language.name)}</b> ${esc(language.level)}</span>`)
      .join("");
  }

  /** Buttons in the contact section: email, CV and social profiles. */
  function renderContactLinks(content) {
    const { t } = content;
    const links = [
      content.email && { label: t("contact.email"), url: `mailto:${content.email}`, primary: true },
      content.resumeUrl && { label: t("contact.cv"), url: content.resumeUrl, download: true },
      ...content.socials,
    ].filter(Boolean);
    $("#contact-links").innerHTML = links
      .map((link) => `
        <a class="btn ${link.primary ? "btn-primary" : "btn-ghost"}" href="${esc(link.url)}"
           ${link.download ? "download" : linkTargetAttrs(link.url)}>
          ${esc(link.label)} <span aria-hidden="true">${link.download ? "↓" : "↗"}</span>
        </a>`)
      .join("");
  }

  function renderSocials(content) {
    $("#socials").innerHTML = [
      ...content.socials,
      content.email && { label: content.email, url: `mailto:${content.email}` },
    ]
      .filter(Boolean)
      .map((s) => `<a href="${esc(s.url)}" ${linkTargetAttrs(s.url)}>${esc(s.label)}</a>`)
      .join("");
  }

  function renderAll(content) {
    renderIdentity(content);
    renderLogoMarquee();
    renderStats(content.stats);
    renderServices(content.services);
    renderProjects(content.projects, content.t);
    renderProcess(content.process);
    renderJourney(content.journey);
    renderCertifications(content.certifications, content.languages, content.t);
    renderContactLinks(content);
    renderSocials(content);
  }

  return { renderAll };
})();
