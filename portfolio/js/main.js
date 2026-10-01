/**
 * Entry point. Content is rendered first so the behaviour scripts
 * can find the elements they attach to.
 */
(() => {
  "use strict";
  const content = window.PORTFOLIO;
  const { sections, hero, projects, effects, nav, contactForm } = window.App;

  sections.renderAll(content);
  hero.init(content);
  projects.init(content.projects);
  nav.init();
  contactForm.init(content.email);
  effects.init();
})();
