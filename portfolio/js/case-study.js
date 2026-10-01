/**
 * Project case study: clicking a project card opens a <dialog> with
 * the problem, an architecture strip, what was built, results, the
 * screenshot or demo video, and links to the code.
 */
window.App.caseStudy = (() => {
  "use strict";
  const { $, escapeHtml: esc } = window.App;

  const youtubeEmbed = (id) =>
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`;
  const youtubeWatch = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

  const list = (items) => `<ul class="case-list">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;

  function mediaHtml(project) {
    const media = project.media;
    if (media?.type === "image") {
      return `<figure class="case-media"><img src="${esc(media.src)}" alt="${esc(project.title)}" /></figure>`;
    }
    if (media?.type === "youtube") {
      // The iframe is only created when the dialog opens, and removed on close (stops playback).
      return `<figure class="case-media case-video">
        <iframe src="${youtubeEmbed(media.id)}" title="${esc(project.title)}" loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>
      </figure>`;
    }
    return "";
  }

  function architectureHtml(steps) {
    return `<ol class="case-architecture">${steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>`;
  }

  function render(project, t) {
    const videoLink = project.media?.type === "youtube"
      ? `<a class="btn btn-ghost" href="${youtubeWatch(project.media.id)}" target="_blank" rel="noopener">${esc(t("case.video"))} <span aria-hidden="true">↗</span></a>`
      : "";
    return `
      <header class="case-header">
        <div>
          <p class="eyebrow">${esc(t(`work.category.${project.category}`))} · ${esc(project.year)}</p>
          <h2 id="case-study-title">${esc(project.title)}</h2>
        </div>
        <button class="case-close" type="button" data-close aria-label="${esc(t("case.close"))}">✕</button>
      </header>
      ${mediaHtml(project)}
      <section><h3>${esc(t("case.problem"))}</h3><p>${esc(project.problem)}</p></section>
      <section><h3>${esc(t("case.architecture"))}</h3>${architectureHtml(project.architecture)}</section>
      <div class="case-columns">
        <section><h3>${esc(t("case.built"))}</h3>${list(project.built)}</section>
        <section><h3>${esc(t("case.results"))}</h3>${list(project.results)}</section>
      </div>
      <div class="tags">${project.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
      <footer class="case-actions">
        <a class="btn btn-primary" href="${esc(project.url)}" target="_blank" rel="noopener">${esc(t("case.code"))} <span aria-hidden="true">↗</span></a>
        ${videoLink}
      </footer>`;
  }

  function init(projects, t) {
    const dialog = $("#case-study");
    const body = $("#case-study-content");
    const byId = new Map(projects.map((p) => [p.id, p]));

    const close = () => dialog.close();
    dialog.addEventListener("close", () => {
      body.innerHTML = ""; // stops any playing video
      document.body.classList.remove("modal-open");
    });
    // clicking the dimmed backdrop (outside the inner panel) closes it
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest("[data-close]")) close();
    });

    $("#projects-grid").addEventListener("click", (e) => {
      const button = e.target.closest(".project-open");
      if (!button) return;
      const project = byId.get(button.dataset.projectId);
      if (!project) return;
      body.innerHTML = render(project, t);
      document.body.classList.add("modal-open");
      dialog.showModal();
      dialog.scrollTop = 0;
    });
  }

  return { init };
})();
