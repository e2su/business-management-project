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
| Links, numbers, tech stacks, media, email | `js/content/shared.js` |
| English text (and page labels under `ui`) | `js/content/en.js` |
| Arabic text | `js/content/ar.js` |
| Gradient colors and other design tokens | `css/tokens.css` |
| Logos used in the marquee, thumbnails and background | `js/logos-data.js` ([Simple Icons](https://simpleicons.org), CC0) |

> All content comes from the CV and the public repos at github.com/e2su. Add a project by adding an entry to `projects` in `shared.js` and a matching `id` block in `en.js` and `ar.js`.

## File structure

```
index.html              page markup (sections are filled from js/content/)
css/
  tokens.css            colors, fonts, spacing; change the theme here
  base.css              reset, background layers, buttons, cards, reveal animation
  layout.css            navigation, section shell, footer
  sections.css          styles for each page section, in page order
  features.css          case study, EdgeGuard demo, certifications, live GitHub
  rtl.css               Arabic / right-to-left adjustments
assets/                 CV, SCE certificate, KAUST badge, MARKET_OS screenshot
js/
  logos-data.js         brand icon paths and colors
  content/              shared.js (facts) + en.js / ar.js (text)
  core.js               shared helpers, defines window.App
  i18n.js               picks English/Arabic, builds App.content, fills labels
  pacman-background.js  animated background (Grid, Maze, Pellets, Actor, game loop)
  sections.js           renders the content into the page
  hero.js               headline animation, typewriter, pipeline + terminal preview
  projects.js           project filter and pixel-art thumbnails
  case-study.js         project detail dialog (video, screenshot, architecture)
  edgeguard-demo.js     interactive risk gauge using EdgeGuard's real risk map
  github-live.js        repos, languages and recent activity from the GitHub API
  effects.js            scroll reveals, counters, card spotlight, cursor glow
  nav.js                nav bar state and mobile menu
  contact-form.js       form validation and the mailto link
  main.js               starts everything
```

Scripts are plain (non-module) files that share one global, `window.App`. That keeps the site working when `index.html` is opened straight from disk. Load order is set at the bottom of `index.html`.

## Background animation

The ghosts are app logos in rounded squares, in each brand's color. Pac-Man eats pellets. After a power pellet the squares turn blue and he chases them. Squares move away from the mouse pointer. To tweak speeds, counts or timings, edit `CONFIG` at the top of `js/pacman-background.js`.

The site respects `prefers-reduced-motion`.

## Publishing on GitHub Pages

`.github/workflows/deploy-portfolio.yml` publishes this folder whenever `portfolio/` changes on `main`.
One-time setup: repository **Settings → Pages → Source: GitHub Actions**. The site will then be at
`https://e2su.github.io/business-management-project/`.
