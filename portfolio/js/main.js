/**
 * Entry point. Language is resolved first (it builds App.content),
 * then content is rendered so the behaviour scripts can find the
 * elements they attach to.
 */
(() => {
  "use strict";
  const App = window.App;
  const content = App.i18n.init();
  App.content = content;

  App.sections.renderAll(content);
  App.hero.init(content);
  App.projects.init(content.projects);
  App.caseStudy.init(content.projects, content.t);
  App.edgeguardDemo.init(content.edgeguard);
  App.githubLive.init(content);
  App.nav.init();
  App.contactForm.init(content);
  App.effects.init();
})();
