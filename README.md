# Racing Game

A simple top-down 2D racing game built with HTML Canvas and vanilla JavaScript. No install needed — just open `index.html` in any browser!

## How to Play

| Key | Action |
|---|---|
| `Arrow Up` / `W` | Accelerate |
| `Arrow Down` / `S` | Brake / Reverse |
| `Arrow Left` / `A` | Steer left |
| `Arrow Right` / `D` | Steer right |
| `Space` | Start the game |
| `P` | Pause / Resume |

**Tip:** Drive off the asphalt onto the grass and your car will slow down. Stay on the track for full speed!

Beat all three opponents — orange (slow), purple (medium), and cyan (fast).

## Running Locally

Just open `index.html` in Chrome or Firefox. No server, no install, no build step needed.

## Experimenting with the Code

The tuning constants at the top of `car.js` are fun to change:

```js
var MAX_SPEED    = 250;  // try 400 for chaos!
var TURN_SPEED   = 2.2;  // try 3.5 for twitchy steering
var FRICTION     = 1.5;  // try 0.5 for an icy track
```

## Publishing to GitHub Pages

1. Create a new **public** repository on [github.com](https://github.com)
2. Push this code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/racing-game.git
   git branch -M main
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: main branch / (root) → Save**
4. Your game will be live at `https://YOUR_USERNAME.github.io/racing-game/` in ~2 minutes!

Future updates:
```bash
git add .
git commit -m "describe your change"
git push
```

## File Structure

```
index.html  — page and canvas
style.css   — dark theme styling
track.js    — oval track drawing and collision detection
car.js      — player car physics (great place to experiment!)
lap.js      — lap timer, best lap tracking, HUD
ghost.js    — three AI opponents
game.js     — main game loop, input, screen states
```
