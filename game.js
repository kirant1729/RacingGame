// game.js — Main game loop with top-down 2D rendering

var canvas = document.getElementById('gameCanvas');
var ctx    = canvas.getContext('2d');
var W      = canvas.width;   // 800
var H      = canvas.height;  // 600

// --- Rendering constants ---
// VIEW_SCALE: world units → screen pixels.
// At 0.35 the track (280 u wide) occupies ~98 px; visible area ≈ 2286 × 1714 u.
var VIEW_SCALE = 0.35;

// --- Game state ---
var STATE_START   = 'start';
var STATE_PLAYING = 'playing';
var STATE_PAUSED  = 'paused';
var gameState     = STATE_START;

// --- Game objects ---
var track  = new Track(TRACK_CONFIG);
var player = new Car(800, 1000, 0, '#e94560');
var lap    = new Lap();

// --- Camera ---
var cam = { x: 0, y: 0, angle: 0 };

function updateCamera() {
  cam.angle = player.angle;
  cam.x     = player.x;
  cam.y     = player.y;
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
// Speed-boost ramps
// ─────────────────────────────────────────────
var OBSTACLES = [
  {x: 2870, y: 1300, r: 12},
  {x: 3080, y: 1500, r: 12},
  {x: 2870, y: 1700, r: 12},
  {x: 1800, y: 2000, r: 12},
  {x: 1400, y: 2000, r: 12},
  {x:  330, y: 1700, r: 12},
  {x:  120, y: 1500, r: 12},
  {x:  330, y: 1300, r: 12},
];

// Pre-allocated full-screen ImageData (reused every frame — avoids GC pressure)
var tdImg = ctx.createImageData(W, H);

// ─────────────────────────────────────────────
// Top-down track renderer (ImageData pixel loop — same perf as Mode 7)
// ─────────────────────────────────────────────
function drawTopDown() {
  var px  = tdImg.data;
  var ox  = player.x;
  var oy  = player.y;
  var vs  = VIEW_SCALE;
  var inv = 1 / vs;        // multiply is faster than divide in the inner loop

  for (var sy = 0; sy < H; sy += 2) {
    var wy = oy + (sy - H / 2) * inv;

    for (var sx = 0; sx < W; sx += 2) {
      var wx   = ox + (sx - W / 2) * inv;
      var gx   = wx / GRID_CELL | 0;
      var gy   = wy / GRID_CELL | 0;
      var cell = (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H)
                 ? GRID[gy * GRID_W + gx] : 0;

      var r, g, b;

      if (cell === 3) {
        // Finish line — checkered
        var fc = (((wx / 8 | 0) + (wy / 8 | 0)) & 1);
        if (fc) { r = 255; g = 255; b = 255; }
        else    { r = 20;  g = 20;  b = 20;  }

      } else if (cell === 2) {
        // Road asphalt
        r = 70; g = 70; b = 78;

      } else if (cell === 1) {
        // Curb — per-cell red/white alternating (wall visual)
        if ((gx + gy) & 1) { r = 200; g = 30;  b = 30;  }
        else                { r = 228; g = 228; b = 228; }

      } else {
        // Grass — subtle large checker for depth
        var chk = ((Math.floor(wx / 80) ^ Math.floor(wy / 80)) & 1);
        if (chk) { r = 40; g = 88; b = 38; }
        else     { r = 52; g = 106; b = 50; }
      }

      // Write 2×2 block
      var i00 = (sy * W + sx) * 4;
      var i01 = i00 + 4;
      var i10 = i00 + W * 4;
      var i11 = i10 + 4;

      px[i00] = px[i01] = px[i10] = px[i11] = r;
      px[i00+1] = px[i01+1] = px[i10+1] = px[i11+1] = g;
      px[i00+2] = px[i01+2] = px[i10+2] = px[i11+2] = b;
      px[i00+3] = px[i01+3] = px[i10+3] = px[i11+3] = 255;
    }
  }

  ctx.putImageData(tdImg, 0, 0);
}

// ─────────────────────────────────────────────
// Draw speed-boost ramps as top-down triangles
// ─────────────────────────────────────────────
function drawObstaclesTopDown() {
  for (var i = 0; i < OBSTACLES.length; i++) {
    var obs = OBSTACLES[i];
    var sx  = Math.round(W / 2 + (obs.x - player.x) * VIEW_SCALE);
    var sy  = Math.round(H / 2 + (obs.y - player.y) * VIEW_SCALE);
    var sr  = Math.max(4, obs.r * VIEW_SCALE);
    if (sx < -sr || sx > W + sr || sy < -sr || sy > H + sr) continue;

    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(sx,      sy - sr);
    ctx.lineTo(sx + sr, sy + sr);
    ctx.lineTo(sx - sr, sy + sr);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffee00';
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(2, sr * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─────────────────────────────────────────────
// Draw player car from above (centered on screen)
// ─────────────────────────────────────────────
function drawPlayerCar() {
  var CSCALE = 5;   // inflate car sprite: world units × CSCALE × VIEW_SCALE
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(player.angle);

  var w = player.width  * CSCALE * VIEW_SCALE;   // ≈ 38 px
  var h = player.height * CSCALE * VIEW_SCALE;   // ≈ 21 px

  // Body
  ctx.fillStyle = player.color;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Windshield (front half of car — front is +x after rotate)
  ctx.fillStyle = 'rgba(150,220,255,0.75)';
  ctx.fillRect(-w / 2 + w * 0.55, -h / 2 + h * 0.15, w * 0.30, h * 0.70);

  // Rear window
  ctx.fillStyle = 'rgba(150,220,255,0.45)';
  ctx.fillRect(-w / 2 + w * 0.05, -h / 2 + h * 0.15, w * 0.15, h * 0.70);

  // Wheels (4 corners)
  ctx.fillStyle = '#111';
  ctx.fillRect(-w / 2 - 2,         -h / 2 - 3, w * 0.22, 3);   // front-left
  ctx.fillRect(-w / 2 - 2,          h / 2,      w * 0.22, 3);   // front-right
  ctx.fillRect( w / 2 - w * 0.18,  -h / 2 - 3, w * 0.22, 3);   // rear-left
  ctx.fillRect( w / 2 - w * 0.18,   h / 2,      w * 0.22, 3);   // rear-right

  // White nose dot (direction indicator)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w / 2 + 3, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────
// Speedometer
// ─────────────────────────────────────────────
function drawSpeedometer(speed) {
  var barMaxW = 160, barH = 12;
  var barX    = W - barMaxW - 16;
  var barY    = H - 48;
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
  drawTopDown();
  drawObstaclesTopDown();
  drawPlayerCar();

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.64)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e94560';
  ctx.font      = 'bold 48px Courier New';
  ctx.fillText('RACING GAME', W / 2, 210);

  ctx.fillStyle = '#00ffff';
  ctx.font      = 'bold 15px Courier New';
  ctx.fillText('NASCAR SUPERSPEEDWAY', W / 2, 248);

  ctx.fillStyle = '#fff';
  ctx.font      = '20px Courier New';
  ctx.fillText('Press SPACE to start', W / 2, 310);

  ctx.fillStyle = '#aaa';
  ctx.font      = '14px Courier New';
  ctx.fillText('Arrow keys / WASD to drive   |   P to pause', W / 2, 348);

  ctx.fillStyle = '#ffee77';
  ctx.font      = '13px Courier New';
  ctx.fillText('Hit ramp boosts for extra speed!', W / 2, 385);

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
    var prevX = player.x, prevY = player.y;
    player.update(dt, keys, track);

    // Wall collision — revert to previous position and bounce if car hits grass
    if (track.getCell(player.x, player.y) === 0) {
      player.x = prevX;
      player.y = prevY;
      player.speed *= -0.2;
    }

    lap.update(player, timestamp);
    updateCamera();

    // Ramp collision — speed boost with cooldown
    for (var oi = 0; oi < OBSTACLES.length; oi++) {
      var obs = OBSTACLES[oi];
      var odx = player.x - obs.x, ody = player.y - obs.y;
      if (Math.sqrt(odx * odx + ody * ody) < obs.r + 14 && player.rampCooldown <= 0) {
        player.speed = Math.min(player.speed * 1.5, MAX_SPEED * 1.3);
        player.rampCooldown = 1.0;
      }
    }

    drawTopDown();
    drawObstaclesTopDown();
    drawPlayerCar();
    lap.drawHUD(ctx);
    lap.drawLeaderboard(ctx);
    lap.drawWrongWay(ctx);
    var effSpd = player.offTrack ? Math.abs(player.speed) * OFFTRACK_MULT : Math.abs(player.speed);
    drawSpeedometer(effSpd);

  } else if (gameState === STATE_START) {
    drawStartScreen();

  } else if (gameState === STATE_PAUSED) {
    updateCamera();
    drawTopDown();
    drawObstaclesTopDown();
    drawPlayerCar();
    lap.drawHUD(ctx);
    lap.drawLeaderboard(ctx);
    var pauseSpd = player.offTrack ? Math.abs(player.speed) * OFFTRACK_MULT : Math.abs(player.speed);
    drawSpeedometer(pauseSpd);
    drawPauseScreen();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
