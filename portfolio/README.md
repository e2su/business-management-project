# Portfolio site

A one-page personal portfolio with a black background, a three-color gradient theme and retro-arcade animations. It's plain HTML, CSS and JS, with no build step.

## Run it

```bash
cd portfolio
python3 -m http.server 8000   # then open http://localhost:8000
```

To deploy, upload the folder to any static host, such as GitHub Pages, Netlify or Vercel.

## Make it yours

| What | Where |
|---|---|
| Name, intro, projects, services, testimonials, FAQ, socials, contact email | `js/data.js` |
| Gradient colors (used everywhere, including the games) | `--g1`, `--g2`, `--g3` at the top of `css/styles.css` |
| Logos used by the games and the stack list | `js/logos.js` ([Simple Icons](https://simpleicons.org), CC0) |

## The arcade bits

- **Background (`js/arcade.js`)**: a Pac-Man maze fills the screen. The ghosts are app logos. Pac-Man eats pellets and grabs power pellets, and then hunts the logos. Ghosts flee from your mouse.
- **Play mode**: click **Play** in the nav, or type the Konami code (↑ ↑ ↓ ↓ ← → ← → B A). Steer with the arrow keys or WASD (swipe on phones), and press Esc to exit.
- **Stack section (`js/kong.js`)**: a Donkey Kong-style level. A pixel "bug" throws tech logos down girders and ladders into `/dev/null`, and a little dev jumps over them. Click a rolling logo to smash it.
- **Project thumbnails**: Space Invaders formations built from each project's tech logos. They march when you hover.

The site respects `prefers-reduced-motion`. The stack level only animates while it's on screen.
