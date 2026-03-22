// lap.js — Lap timing, finish-line detection, and HUD overlay

// Finish line: a horizontal stripe across the track at the bottom of the oval
// The oval center is at (400, 300), bottom is around y=520, spanning track width
var FINISH_X = 400;          // x position of finish line (center of track bottom)
var FINISH_Y = 516;          // y position of finish line
var FINISH_HALF_W = 62;      // half-width of the finish stripe (track width at bottom ~130px)
var MIN_LAP_TIME = 3000;     // ms — minimum time between crossings (prevents double-count)

function Lap() {
  this.lapCount = 0;
  this.lapStartTime = null;
  this.currentLapMs = 0;
  this.bestLapMs = Infinity;
  this.bestLapFlashTimer = 0;  // ms remaining for "NEW BEST!" display
  this.lastY = null;           // car's previous y (for crossing detection)
  this.lastCrossTime = 0;      // performance.now() of last crossing
}

// Call every frame before the car moves (pass car object and current timestamp)
Lap.prototype.update = function(car, now) {
  if (this.lapStartTime === null) {
    this.lapStartTime = now;
  }
  this.currentLapMs = now - this.lapStartTime;

  // Tick best-lap flash down
  if (this.bestLapFlashTimer > 0) {
    this.bestLapFlashTimer -= 16; // approximate frame time
  }

  // --- Finish line crossing detection ---
  // Car must be horizontally within the finish stripe
  var nearLine = Math.abs(car.x - FINISH_X) < FINISH_HALF_W;
  // Detect the car crossing the finish line y from above (prevY < finishY) to below (curY >= finishY)
  if (nearLine && this.lastY !== null) {
    var crossed = this.lastY < FINISH_Y && car.y >= FINISH_Y;
    var cooldownOk = (now - this.lastCrossTime) > MIN_LAP_TIME;

    if (crossed && cooldownOk) {
      if (this.lapCount > 0) {
        // Record best lap
        if (this.currentLapMs < this.bestLapMs) {
          this.bestLapMs = this.currentLapMs;
          this.bestLapFlashTimer = 2500;
        }
      }
      this.lapCount++;
      this.lapStartTime = now;
      this.currentLapMs = 0;
      this.lastCrossTime = now;
    }
  }

  this.lastY = car.y;
};

// Draw the checkered finish line stripe
Lap.prototype.drawFinishLine = function(ctx) {
  var squareSize = 10;
  var stripeHeight = 8;
  var cols = Math.floor((FINISH_HALF_W * 2) / squareSize);
  var startX = FINISH_X - FINISH_HALF_W;
  var startY = FINISH_Y - stripeHeight / 2;

  for (var col = 0; col < cols; col++) {
    for (var row = 0; row < 2; row++) {
      var isBlack = (col + row) % 2 === 0;
      ctx.fillStyle = isBlack ? '#000' : '#fff';
      ctx.fillRect(
        startX + col * squareSize,
        startY + row * (stripeHeight / 2),
        squareSize,
        stripeHeight / 2
      );
    }
  }
};

// Format milliseconds as M:SS.mm
function formatTime(ms) {
  if (ms === Infinity) return '--:--.--';
  var minutes = Math.floor(ms / 60000);
  var seconds = Math.floor((ms % 60000) / 1000);
  var centiseconds = Math.floor((ms % 1000) / 10);
  return minutes + ':' +
    (seconds < 10 ? '0' : '') + seconds + '.' +
    (centiseconds < 10 ? '0' : '') + centiseconds;
}

// Draw the HUD overlay (lap count, current time, best time)
Lap.prototype.drawHUD = function(ctx) {
  ctx.save();

  // Semi-transparent HUD bar at top
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, 800, 44);

  ctx.font = 'bold 16px Courier New';
  ctx.textBaseline = 'middle';

  // Lap count (left)
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText('LAP  ' + Math.max(this.lapCount, 1), 16, 22);

  // Current lap time (center)
  ctx.fillStyle = '#ffdd57';
  ctx.textAlign = 'center';
  ctx.fillText(formatTime(this.currentLapMs), 400, 22);

  // Best lap time (right)
  ctx.fillStyle = '#57d9a3';
  ctx.textAlign = 'right';
  ctx.fillText('BEST  ' + formatTime(this.bestLapMs), 784, 22);

  // "NEW BEST!" flash
  if (this.bestLapFlashTimer > 0) {
    var alpha = Math.min(1, this.bestLapFlashTimer / 500);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#57d9a3';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('NEW BEST LAP!', 400, 320);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};
