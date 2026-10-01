# Portfolio site

A one-page personal portfolio with a black background, a three-color gradient theme and a Pac-Man style animated background. It's plain HTML, CSS and JavaScript, with no build step.

## Run it

Double-click `index.html`, or serve the folder:

```bash
cd portfolio
python -m http.server 8000    # Windows: python or py; macOS/Linux: python3
```

Then open http://localhost:8000. To deploy, upload the folder to any static host (GitHub Pages, Netlify, Vercel).

## Make it yours

| What | Where |
|---|---|
| Name, intro, stats, projects, services, journey, socials, contact email | `js/content.js` |
| Gradient colors and other design tokens | `css/tokens.css` |
| Logos used in the marquee, thumbnails and background | `js/logos-data.js` ([Simple Icons](https://simpleicons.org), CC0) |

> Everything in `js/content.js` comes from the public repos at github.com/e2su. Fields marked `TODO` (email, LinkedIn, CV, dates) are still missing; the page hides empty fields, and the contact form only appears once `email` is set.

## File structure

```
index.html              page markup (sections are filled from content.js)
css/
  tokens.css            colors, fonts, spacing; change the theme here
  base.css              reset, background layers, buttons, cards, reveal animation
  layout.css            navigation, section shell, footer
  sections.css          styles for each page section, in page order
js/
  logos-data.js         brand icon paths and colors
  content.js            all the text on the site
  core.js               shared helpers, defines window.App
  pacman-background.js  animated background (Grid, Maze, Pellets, Actor, game loop)
  sections.js           renders the content into the page
  hero.js               headline animation, typewriter, pipeline + terminal preview
  projects.js           project filter and pixel-art thumbnails
  effects.js            scroll reveals, counters, card spotlight, cursor glow
  nav.js                nav bar state and mobile menu
  contact-form.js       form validation and the mailto link
  main.js               starts everything
```

Scripts are plain (non-module) files that share one global, `window.App`. That keeps the site working when `index.html` is opened straight from disk. Load order is set at the bottom of `index.html`.

## Background animation

The ghosts are app logos in rounded squares, in each brand's color. Pac-Man eats pellets. After a power pellet the squares turn blue and he chases them. Squares move away from the mouse pointer. To tweak speeds, counts or timings, edit `CONFIG` at the top of `js/pacman-background.js`.

The site respects `prefers-reduced-motion`.
