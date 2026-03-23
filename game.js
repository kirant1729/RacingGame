// game.js — Main game loop with Mode 7 pseudo-3D rendering

var canvas = document.getElementById('gameCanvas');
var ctx    = canvas.getContext('2d');
var W      = canvas.width;   // 800
var H      = canvas.height;  // 600

// --- Rendering constants ---
var HORIZON    = 300;   // screen y dividing sky and road
var CAM_HEIGHT = 80;    // camera height above ground
var FOCAL_LEN  = 250;   // perspective focal length

// --- Game state ---
var STATE_START   = 'start';
var STATE_PLAYING = 'playing';
var STATE_PAUSED  = 'paused';
var gameState     = STATE_START;

// --- Game objects ---
var track  = new Track(TRACK_CONFIG);
var player = new Car(600, 1200, 0, '#e94560');
var lap    = new Lap();

// --- Camera ---
var cam = { x: 0, y: 0, angle: 0 };

function updateCamera() {
  cam.angle = player.angle;
  cam.x     = player.x - Math.cos(player.angle) * 50;
  cam.y     = player.y - Math.sin(player.angle) * 50;
}

// --- Input ---
var keys = { up: false, down: false, left: false, right: false };

document.addEventListener('keydown', function(e) {
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': keys.up    = true;  e.preventDefault(); break;
    case 'ArrowDown':  case 's': case 'S': keys.down  = true;  e.preventDefault(); break;
    case 'ArrowLeft':  case 'a': case 'A': keys.left  = true;  e.preventDefault(); break;
    case 'ArrowRight': case 'd': case 'D': keys.right = true;  e.preventDefault(); break;
    case ' ':
      if (gameState === STATE_START) gameState = STATE_PLAYING;
      e.preventDefault();
      break;
    case 'p': case 'P':
      if (gameState === STATE_PLAYING)      gameState = STATE_PAUSED;
      else if (gameState === STATE_PAUSED)  gameState = STATE_PLAYING;
      break;
  }
});

document.addEventListener('keyup', function(e) {
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': keys.up    = false; break;
    case 'ArrowDown':  case 's': case 'S': keys.down  = false; break;
    case 'ArrowLeft':  case 'a': case 'A': keys.left  = false; break;
    case 'ArrowRight': case 'd': case 'D': keys.right = false; break;
  }
});

// ─────────────────────────────────────────────
// Pre-generate stars (static positions)
// ─────────────────────────────────────────────
var STARS = (function() {
  var arr = [];
  for (var i = 0; i < 200; i++) {
    arr.push({
      x: Math.random() * W,
      y: Math.random() * (HORIZON - 30),
      r: Math.random() < 0.12 ? 1.4 : 0.6,
      a: 0.3 + Math.random() * 0.7
    });
  }
  return arr;
}());

// ─────────────────────────────────────────────
// Pre-generate futuristic city buildings
// ─────────────────────────────────────────────
var NEON_COLS = ['#00ffff', '#ff00ff', '#ff6600', '#00ff88', '#ffff00', '#ff2266'];
var DARK_COLS = ['#070c18', '#0a1020', '#060810', '#0c1428', '#080a14'];

var CITY = (function() {
  var arr = [];
  for (var i = 0; i < 120; i++) {
    var h     = 38 + Math.random() * 200;
    var w     = 16 + Math.random() * 44;
    var wRows = Math.max(1, Math.floor(h / 18));
    var wCols = Math.max(1, Math.floor(w / 9));
    // Pre-bake lit/unlit windows so they don't flicker
    var wins = [];
    for (var r = 0; r < wRows; r++) {
      wins.push([]);
      for (var c = 0; c < wCols; c++) {
        wins[r].push(Math.random() > 0.35);
      }
    }
    arr.push({
      angle:    (i / 120) * Math.PI * 2,
      h: h, w: w,
      color:    DARK_COLS[i % DARK_COLS.length],
      neon:     NEON_COLS[i % NEON_COLS.length],
      wRows: wRows, wCols: wCols, wins: wins,
      hasSpire: Math.random() > 0.55,
      spireH:   12 + Math.random() * 50
    });
  }
  return arr;
}());

// Pre-allocated road ImageData (reused every frame — no GC pressure)
var roadImg = ctx.createImageData(W, H - HORIZON);

// ─────────────────────────────────────────────
// Draw sky gradient + stars + city skyline
// ─────────────────────────────────────────────
function drawBackground() {
  // Sky gradient
  var sg = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sg.addColorStop(0,   '#000008');
  sg.addColorStop(0.6, '#06062c');
  sg.addColorStop(1,   '#1a0840');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, HORIZON);

  // Stars
  for (var i = 0; i < STARS.length; i++) {
    var s = STARS[i];
    ctx.globalAlpha = s.a;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Horizon purple glow
  var hg = ctx.createLinearGradient(0, HORIZON - 90, 0, HORIZON);
  hg.addColorStop(0, 'rgba(40,0,100,0)');
  hg.addColorStop(1, 'rgba(100,30,220,0.4)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, HORIZON - 90, W, 90);

  // ── City buildings ──────────────────────────
  var normAngle = ((cam.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  var FOV       = Math.PI * 0.72;   // ~130° horizontal FOV for buildings
  var pxPerRad  = W / FOV;

  for (var j = 0; j < CITY.length; j++) {
    var b  = CITY[j];
    var da = b.angle - normAngle;
    if (da >  Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > FOV * 0.58) continue;   // outside view

    var bx   = Math.round(W / 2 + da * pxPerRad);
    var bTop = HORIZON - b.h;

    // Building body
    ctx.fillStyle = b.color;
    ctx.fillRect(bx - b.w / 2, bTop, b.w, b.h);

    // Neon edge outline
    ctx.strokeStyle = b.neon;
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx - b.w / 2 + 0.5, bTop + 0.5, b.w - 1, b.h - 1);

    // Spire
    if (b.hasSpire) {
      ctx.strokeStyle = b.neon;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, bTop);
      ctx.lineTo(bx, bTop - b.spireH);
      ctx.stroke();
    }

    // Windows
    var ww = Math.max(2, b.w / b.wCols - 2);
    for (var rr = 0; rr < b.wRows; rr++) {
      for (var cc = 0; cc < b.wCols; cc++) {
        if (b.wins[rr][cc]) {
          ctx.fillStyle = 'rgba(255,220,80,0.65)';
          ctx.fillRect(
            bx - b.w / 2 + 2 + cc * (b.w / b.wCols),
            bTop + 4 + rr * 18,
            ww, 11
          );
        }
      }
    }
  }
}

// ─────────────────────────────────────────────
// Speed-boost ramps (small yellow wedges)
// ─────────────────────────────────────────────
var OBSTACLES = [
  {x: 1870, y: 1360, r: 12},  // Turn 1 entry
  {x: 2040, y: 1450, r: 12},  // Right apex
  {x: 1870, y: 1640, r: 12},  // Turn 2 exit
  {x: 1250, y: 1700, r: 12},  // Back straight mid
  {x:  750, y: 1700, r: 12},  // Back straight mid
  {x:  230, y: 1640, r: 12},  // Turn 3 entry
  {x:  160, y: 1450, r: 12},  // Left apex
  {x:  230, y: 1260, r: 12}   // Turn 4 exit
];

// ─────────────────────────────────────────────
// Mode 7 scanline road renderer (grid-based)
// ─────────────────────────────────────────────
function drawRoad() {
  var px   = roadImg.data;
  var cosA = Math.cos(cam.angle);
  var sinA = Math.sin(cam.angle);

  for (var row = 0; row < H - HORIZON; row += 2) {
    var rowFH = row + 1;
    var depth = CAM_HEIGHT * FOCAL_LEN / rowFH;
    var dof   = depth / FOCAL_LEN;

    var wxL = cam.x + cosA * depth + sinA * (W / 2) * dof;
    var wyL = cam.y + sinA * depth - cosA * (W / 2) * dof;
    var wxS = -sinA * dof;
    var wyS =  cosA * dof;

    // Depth band for road striping
    var band = (Math.floor(depth / 60) & 1);

    var wx = wxL, wy = wyL;

    for (var col = 0; col < W; col += 2) {
      var r, g, b;

      // Grid lookup — O(1), no ellipse math
      var gx   = wx / GRID_CELL | 0;
      var gy   = wy / GRID_CELL | 0;
      var cell = (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H)
                 ? GRID[gy * GRID_W + gx] : 0;

      if (cell === 3) {
        // Finish line — checkered flag
        var fc = (((wx / 10 | 0) + (wy / 10 | 0)) & 1);
        if (fc) { r = 255; g = 255; b = 255; }
        else    { r = 0;   g = 0;   b = 0; }

      } else if (cell === 2) {
        // Road asphalt — alternating bands give depth cue
        if (band) { r = 82; g = 82; b = 88; }
        else      { r = 66; g = 66; b = 72; }

      } else if (cell === 1) {
        // Curb — red / white alternating blocks
        var cb = ((Math.floor(wx / 12) ^ Math.floor(wy / 12)) & 1);
        if (cb) { r = 210; g = 18; b = 18; }
        else    { r = 235; g = 235; b = 235; }

      } else {
        // Grass — subtle checkerboard
        var chk = ((Math.floor(wx / 50) ^ Math.floor(wy / 50)) & 1);
        if (chk) { r = 42; g = 88; b = 40; }
        else     { r = 54; g = 108; b = 50; }
      }

      var i00 = (row * W + col) * 4;
      var i01 = i00 + 4;
      var i10 = i00 + W * 4;
      var i11 = i10 + 4;

      px[i00] = px[i01] = px[i10] = px[i11] = r;
      px[i00+1] = px[i01+1] = px[i10+1] = px[i11+1] = g;
      px[i00+2] = px[i01+2] = px[i10+2] = px[i11+2] = b;
      px[i00+3] = px[i01+3] = px[i10+3] = px[i11+3] = 255;

      wx += wxS * 2;
      wy += wyS * 2;
    }
  }

  ctx.putImageData(roadImg, 0, HORIZON);
}

// ─────────────────────────────────────────────
// Draw speed-boost ramps as 3D yellow wedges
// ─────────────────────────────────────────────
function drawObstacles() {
  var cosA = Math.cos(cam.angle);
  var sinA = Math.sin(cam.angle);

  for (var i = 0; i < OBSTACLES.length; i++) {
    var obs = OBSTACLES[i];
    var dx  = obs.x - cam.x;
    var dy  = obs.y - cam.y;
    var fwd = dx * cosA + dy * sinA;
    if (fwd < 10) continue;
    var lat = -dx * sinA + dy * cosA;
    var sx  = W / 2 + lat * FOCAL_LEN / fwd;
    var sy  = HORIZON + CAM_HEIGHT * FOCAL_LEN / fwd;
    var sc  = FOCAL_LEN / fwd;
    var sw  = Math.max(6, obs.r * 2.5 * sc);
    var sh  = Math.max(4, obs.r * 2.0 * sc);
    if (sx < -sw || sx > W + sw || sy > H) continue;

    // Ramp wedge — orange base, yellow top, white stripe
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(sx - sw / 2, sy);           // bottom-left
    ctx.lineTo(sx + sw / 2, sy);           // bottom-right
    ctx.lineTo(sx + sw / 2, sy - sh * 0.5); // right mid
    ctx.lineTo(sx,          sy - sh);      // top-center apex
    ctx.lineTo(sx - sw / 2, sy - sh * 0.5); // left mid
    ctx.closePath();
    ctx.fill();

    // Yellow highlight stripe
    ctx.fillStyle = '#ffee00';
    ctx.beginPath();
    ctx.moveTo(sx - sw * 0.25, sy - sh * 0.4);
    ctx.lineTo(sx + sw * 0.25, sy - sh * 0.4);
    ctx.lineTo(sx,             sy - sh * 0.9);
    ctx.closePath();
    ctx.fill();

    // Thin outline
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth   = Math.max(1, sc);
    ctx.beginPath();
    ctx.moveTo(sx - sw / 2, sy);
    ctx.lineTo(sx + sw / 2, sy);
    ctx.lineTo(sx + sw / 2, sy - sh * 0.5);
    ctx.lineTo(sx,          sy - sh);
    ctx.lineTo(sx - sw / 2, sy - sh * 0.5);
    ctx.closePath();
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────
// Draw opponent cars as realistic 3D sprites
// ─────────────────────────────────────────────
function drawOpponents() {
  var cosA = Math.cos(cam.angle);
  var sinA = Math.sin(cam.angle);

  var visible = [];
  for (var i = 0; i < ghosts.length; i++) {
    var gh  = ghosts[i];
    var dx  = gh.x - cam.x, dy = gh.y - cam.y;
    var fwd = dx * cosA + dy * sinA;
    var lat = -dx * sinA + dy * cosA;
    if (fwd < 15) continue;
    var sx = W / 2 + lat * FOCAL_LEN / fwd;
    var sy = HORIZON + CAM_HEIGHT * FOCAL_LEN / fwd;
    var sc = FOCAL_LEN / fwd;
    if (sx < -100 || sx > W + 100 || sy > H - 80) continue;
    visible.push({ ghost: gh, sx: sx, sy: sy, sc: sc, depth: fwd });
  }
  visible.sort(function(a, b) { return b.depth - a.depth; });

  for (var j = 0; j < visible.length; j++) {
    var v  = visible[j];
    var cw = Math.max(10, 52 * v.sc);   // car width
    var ch = Math.max(5,  28 * v.sc);   // car height
    var bx = v.sx, by = v.sy;
    var col = v.ghost.color;

    // ── Rear diffuser (wide dark base) ──────────
    ctx.fillStyle = '#111';
    ctx.fillRect(bx - cw * 0.62, by - ch * 0.22, cw * 1.24, ch * 0.22);

    // ── Side pods (flanking lower body) ─────────
    ctx.fillStyle = col;
    ctx.fillRect(bx - cw * 0.60, by - ch * 0.75, cw * 0.17, ch * 0.55);
    ctx.fillRect(bx + cw * 0.43, by - ch * 0.75, cw * 0.17, ch * 0.55);

    // ── Main body ───────────────────────────────
    ctx.fillStyle = col;
    ctx.fillRect(bx - cw * 0.42, by - ch, cw * 0.84, ch);

    // ── Livery accent stripe ─────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(bx - cw * 0.40, by - ch, cw * 0.08, ch * 0.85);

    // ── Rear wing (wide, thin, above body) ──────
    ctx.fillStyle = '#222';
    ctx.fillRect(bx - cw * 0.56, by - ch - ch * 0.18, cw * 1.12, ch * 0.12);
    // Wing endplates
    ctx.fillStyle = col;
    ctx.fillRect(bx - cw * 0.60, by - ch - ch * 0.22, cw * 0.08, ch * 0.22);
    ctx.fillRect(bx + cw * 0.52, by - ch - ch * 0.22, cw * 0.08, ch * 0.22);

    // ── Cockpit / roll hoop ──────────────────────
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.ellipse(bx - cw * 0.06, by - ch * 0.72,
                cw * 0.20, ch * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Roll hoop bar
    ctx.fillStyle = '#333';
    ctx.fillRect(bx - cw * 0.04, by - ch - ch * 0.05, cw * 0.08, ch * 0.40);

    // ── Nose cone (pointed front) ────────────────
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(bx + cw * 0.42, by - ch * 0.75);
    ctx.lineTo(bx + cw * 0.65, by - ch * 0.35);
    ctx.lineTo(bx + cw * 0.42, by - ch * 0.10);
    ctx.closePath();
    ctx.fill();

    // ── Front wing ───────────────────────────────
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bx + cw * 0.38, by - ch * 0.14, cw * 0.28, ch * 0.08);

    // ── Wheels (dark, wide) ──────────────────────
    ctx.fillStyle = '#111';
    // Rear (left on screen = car's left)
    ctx.fillRect(bx - cw * 0.62, by - ch * 0.36, cw * 0.20, ch * 0.36);
    // Rear right
    ctx.fillRect(bx + cw * 0.42, by - ch * 0.36, cw * 0.20, ch * 0.36);

    // Tyre highlight
    ctx.fillStyle = 'rgba(80,80,80,0.7)';
    ctx.fillRect(bx - cw * 0.60, by - ch * 0.34, cw * 0.05, ch * 0.30);
    ctx.fillRect(bx + cw * 0.55, by - ch * 0.34, cw * 0.05, ch * 0.30);
  }
}

// ─────────────────────────────────────────────
// Draw player car hood / cockpit view
// ─────────────────────────────────────────────
function drawCarHood() {
  var hw = W / 2;

  // ── Side pods (visible on each side) ─────────
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.moveTo(0,         H);
  ctx.lineTo(hw - 90,   H);
  ctx.lineTo(hw - 70,   H - 115);
  ctx.lineTo(0,         H - 80);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(W,         H);
  ctx.lineTo(hw + 90,   H);
  ctx.lineTo(hw + 70,   H - 115);
  ctx.lineTo(W,         H - 80);
  ctx.closePath();
  ctx.fill();

  // ── Main hood (narrow nose cone perspective) ──
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.moveTo(hw - 90,  H);
  ctx.lineTo(hw + 90,  H);
  ctx.lineTo(hw + 38,  H - 115);
  ctx.lineTo(hw - 38,  H - 115);
  ctx.closePath();
  ctx.fill();

  // Hood sheen
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.beginPath();
  ctx.moveTo(hw - 80,  H);
  ctx.lineTo(hw - 10,  H);
  ctx.lineTo(hw - 18,  H - 115);
  ctx.lineTo(hw - 38,  H - 115);
  ctx.closePath();
  ctx.fill();

  // ── Dashboard bar ─────────────────────────────
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, H - 118, W, 18);

  // ── Cockpit opening (dark visor area) ─────────
  ctx.fillStyle = '#060612';
  ctx.beginPath();
  ctx.ellipse(hw, H - 118, 48, 20, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // ── Helmet inside cockpit ─────────────────────
  // Helmet body
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.ellipse(hw, H - 132, 22, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Visor
  ctx.fillStyle = 'rgba(80,200,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(hw + 6, H - 132, 14, 10, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Visor glint
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(hw + 2, H - 137, 5, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // ── Roll hoop ────────────────────────────────
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(hw - 6, H - 160, 12, 42);
  ctx.fillStyle = '#333';
  ctx.fillRect(hw - 22, H - 162, 44, 6);

  // ── Headlights ────────────────────────────────
  ctx.fillStyle = 'rgba(255,252,190,0.95)';
  ctx.beginPath();
  ctx.ellipse(hw - 32, H - 120, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hw + 32, H - 120, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glow
  ctx.fillStyle = 'rgba(200,230,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(hw - 32, H - 120, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hw + 32, H - 120, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ─────────────────────────────────────────────
// Speedometer
// ─────────────────────────────────────────────
function drawSpeedometer(speed) {
  var barMaxW = 160, barH = 12;
  var barX    = W - barMaxW - 16;
  var barY    = H - 155;   // above the car hood
  var frac    = Math.min(speed / MAX_SPEED, 1);
  var barW    = Math.round(barMaxW * frac);
  var kmh     = Math.round(speed * 0.72);

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(barX - 4, barY - 18, barMaxW + 8, barH + 22);

  ctx.fillStyle = '#aaa';
  ctx.font      = '10px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText('SPEED  ' + kmh + ' km/h', barX, barY - 5);

  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barMaxW, barH);

  var rr = Math.round(255 * frac);
  var gg = Math.round(255 * (1 - frac * 0.6));
  ctx.fillStyle = 'rgb(' + rr + ',' + gg + ',40)';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.restore();
}

// ─────────────────────────────────────────────
// Start screen
// ─────────────────────────────────────────────
function drawStartScreen() {
  updateCamera();
  drawBackground();
  drawRoad();
  drawObstacles();
  drawOpponents();
  drawCarHood();

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.64)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e94560';
  ctx.font      = 'bold 48px Courier New';
  ctx.fillText('RACING GAME', W / 2, 210);

  ctx.fillStyle = '#00ffff';
  ctx.font      = 'bold 15px Courier New';
  ctx.fillText('NASCAR-STYLE OVAL', W / 2, 248);

  ctx.fillStyle = '#fff';
  ctx.font      = '20px Courier New';
  ctx.fillText('Press SPACE to start', W / 2, 310);

  ctx.fillStyle = '#aaa';
  ctx.font      = '14px Courier New';
  ctx.fillText('Arrow keys / WASD to drive   |   P to pause', W / 2, 348);

  var lc = ['#ff8c00', '#a855f7', '#22d3ee'];
  var ll = ['Orange opponent  (slow)', 'Purple opponent  (medium)', 'Cyan opponent    (fast)'];
  for (var i = 0; i < 3; i++) {
    ctx.fillStyle = lc[i];
    ctx.fillRect(W / 2 - 90, 400 + i * 24, 14, 9);
    ctx.fillStyle  = '#ddd';
    ctx.font       = '13px Courier New';
    ctx.textAlign  = 'left';
    ctx.fillText(ll[i], W / 2 - 72, 409 + i * 24);
  }
  ctx.restore();
}

// ─────────────────────────────────────────────
// Pause screen
// ─────────────────────────────────────────────
function drawPauseScreen() {
  ctx.save();
  ctx.fillStyle  = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign  = 'center';
  ctx.fillStyle  = '#fff';
  ctx.font       = 'bold 40px Courier New';
  ctx.fillText('PAUSED', W / 2, 290);
  ctx.font       = '18px Courier New';
  ctx.fillStyle  = '#aaa';
  ctx.fillText('Press P to continue', W / 2, 335);
  ctx.restore();
}

// ─────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────
var lastTime = null;

function loop(timestamp) {
  var dt = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (gameState === STATE_PLAYING) {
    player.update(dt, keys, track);
    ghosts.forEach(function(g) { g.update(dt); });
    lap.update(player, timestamp);
    updateCamera();

    // Ramp collision — speed boost with cooldown
    for (var oi = 0; oi < OBSTACLES.length; oi++) {
      var obs = OBSTACLES[oi];
      var odx = player.x - obs.x, ody = player.y - obs.y;
      if (Math.sqrt(odx * odx + ody * ody) < obs.r + 14 && player.rampCooldown <= 0) {
        player.speed = Math.min(player.speed * 1.5, MAX_SPEED * 1.3);
        player.rampCooldown = 1.0;  // 1 second before another ramp can trigger
      }
    }

    drawBackground();
    drawRoad();
    drawObstacles();
    drawOpponents();
    drawCarHood();
    lap.drawHUD(ctx);
    lap.drawWrongWay(ctx);
    var effSpd = player.offTrack ? Math.abs(player.speed) * OFFTRACK_MULT : Math.abs(player.speed);
    drawSpeedometer(effSpd);

  } else if (gameState === STATE_START) {
    drawStartScreen();

  } else if (gameState === STATE_PAUSED) {
    updateCamera();
    drawBackground();
    drawRoad();
    drawObstacles();
    drawOpponents();
    drawCarHood();
    lap.drawHUD(ctx);
    var pauseSpd = player.offTrack ? Math.abs(player.speed) * OFFTRACK_MULT : Math.abs(player.speed);
    drawSpeedometer(pauseSpd);
    drawPauseScreen();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
