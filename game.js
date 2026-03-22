// game.js — Main game loop, input wiring, and object orchestration

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');

// --- Game state ---
var STATE_START   = 'start';
var STATE_PLAYING = 'playing';
var STATE_PAUSED  = 'paused';
var gameState = STATE_START;

// --- Create game objects ---
var track = new Track(TRACK_CONFIG);

// Player car starts at the bottom of the oval, pointing right (angle = 0)
var player = new Car(400, 516, 0, '#e94560');

var lap = new Lap();

// --- Input map ---
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
      if (gameState === STATE_PLAYING) gameState = STATE_PAUSED;
      else if (gameState === STATE_PAUSED) gameState = STATE_PLAYING;
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

// --- Speedometer ---
function drawSpeedometer(speed) {
  var barMaxW = 160;
  var barH = 12;
  var barX = 800 - barMaxW - 16;
  var barY = 600 - barH - 12;
  var fraction = Math.min(Math.abs(speed) / MAX_SPEED, 1);
  var barW = Math.round(barMaxW * fraction);

  ctx.save();
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(barX - 4, barY - 18, barMaxW + 8, barH + 22);

  // Label
  ctx.fillStyle = '#aaa';
  ctx.font = '10px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText('SPEED', barX, barY - 5);

  // Bar track
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barMaxW, barH);

  // Bar fill — green to yellow to red based on speed
  var r = Math.round(255 * fraction);
  var g = Math.round(255 * (1 - fraction * 0.6));
  ctx.fillStyle = 'rgb(' + r + ',' + g + ',40)';
  ctx.fillRect(barX, barY, barW, barH);

  ctx.restore();
}

// --- Start screen ---
function drawStartScreen() {
  track.draw(ctx);
  lap.drawFinishLine(ctx);
  ghosts.forEach(function(g) { g.draw(ctx); });
  player.draw(ctx);

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, 800, 600);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e94560';
  ctx.font = 'bold 48px Courier New';
  ctx.fillText('RACING GAME', 400, 230);

  ctx.fillStyle = '#fff';
  ctx.font = '20px Courier New';
  ctx.fillText('Press SPACE to start', 400, 300);

  ctx.fillStyle = '#aaa';
  ctx.font = '14px Courier New';
  ctx.fillText('Arrow keys / WASD to drive   |   P to pause', 400, 340);

  ctx.fillStyle = '#ff8c00';
  ctx.fillRect(320, 390, 14, 9);
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(320, 410, 14, 9);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(320, 430, 14, 9);

  ctx.fillStyle = '#ddd';
  ctx.font = '13px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText('Orange opponent  (slow)', 342, 399);
  ctx.fillText('Purple opponent  (medium)', 342, 419);
  ctx.fillText('Cyan opponent    (fast)', 342, 439);

  ctx.restore();
}

// --- Pause screen ---
function drawPauseScreen() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, 800, 600);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px Courier New';
  ctx.fillText('PAUSED', 400, 290);

  ctx.font = '18px Courier New';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Press P to continue', 400, 335);
  ctx.restore();
}

// --- Main loop ---
var lastTime = null;

function loop(timestamp) {
  var dt = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (gameState === STATE_PLAYING) {
    // Update
    player.update(dt, keys, track);
    ghosts.forEach(function(g) { g.update(dt); });
    lap.update(player, timestamp);

    // Draw
    track.draw(ctx);
    lap.drawFinishLine(ctx);
    ghosts.forEach(function(g) { g.draw(ctx); });
    player.draw(ctx);
    lap.drawHUD(ctx);
    drawSpeedometer(player.speed);

  } else if (gameState === STATE_START) {
    drawStartScreen();

  } else if (gameState === STATE_PAUSED) {
    // Re-draw the static scene then overlay the pause screen
    track.draw(ctx);
    lap.drawFinishLine(ctx);
    ghosts.forEach(function(g) { g.draw(ctx); });
    player.draw(ctx);
    lap.drawHUD(ctx);
    drawSpeedometer(player.speed);
    drawPauseScreen();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
