/**
 * Navigation bar: background once the page scrolls, highlight of
 * the section currently on screen, and the mobile menu toggle.
 */
window.App.nav = (() => {
  "use strict";
  const { $, $$ } = window.App;

  function solidBackgroundOnScroll(nav) {
    const update = () => nav.classList.toggle("scrolled", window.scrollY > 20);
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function highlightCurrentSection(links) {
    const linkFor = (section) => links.find((a) => a.getAttribute("href") === `#${section.id}`);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          links.forEach((a) => a.classList.toggle("active", a === linkFor(entry.target)));
        }
      },
      // a section counts as "current" when it crosses the middle of the screen
      { rootMargin: "-45% 0px -50% 0px" },
    );
    links.forEach((a) => {
      const section = $(a.getAttribute("href"));
      if (section) observer.observe(section);
    });
  }

  function mobileMenu(button, menu, links) {
    const setOpen = (open) => {
      menu.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
    };
    button.addEventListener("click", () => setOpen(!menu.classList.contains("open")));
    links.forEach((a) => a.addEventListener("click", () => setOpen(false)));
  }

  function init() {
    const links = $$(".nav-links a");
    solidBackgroundOnScroll($("#nav"));
    highlightCurrentSection(links);
    mobileMenu($("#menu-button"), $("#nav-links"), links);
  }

  return { init };
})();
