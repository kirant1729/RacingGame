// lap.js — Lap timing, finish-line detection, and HUD overlay

// Finish line: x=700 on the front straight (y=1000) of the big oval.
var FINISH_X      = 700;   // x position of the vertical finish line
var FINISH_Y      = 1000;  // center y of the track at the finish line
var FINISH_HALF_H = 80;    // half-height of the detection zone
var MIN_LAP_TIME  = 3000; // ms — minimum time between crossings (prevents double-count)

function Lap() {
  this.lapCount = 0;
  this.lapStartTime = null;
  this.currentLapMs = 0;
  this.bestLapMs = Infinity;
  this.bestLapFlashTimer = 0;  // ms remaining for "NEW BEST!" display
  this.lastCrossTime = 0;      // timestamp of last valid crossing
  this.wrongWayTimer = 0;      // ms remaining for "WRONG WAY!" display
  this.lastWrongWayTime = 0;
  this.lastX = null;           // kept for wrong-way detection only
  // armed: true once the car has been west of the finish zone, enabling the next
  // east crossing to count as a lap.
  this.armed = false;
  this.lapTimes = [];          // completed lap times in ms (chronological order)
}

// Call every frame (pass car object and current timestamp)
Lap.prototype.update = function(car, now) {
  if (this.lapStartTime === null) {
    this.lapStartTime = now;
  }
  this.currentLapMs = now - this.lapStartTime;

  if (this.bestLapFlashTimer > 0) this.bestLapFlashTimer -= 16;

  var onTrack   = car.y > (FINISH_Y - FINISH_HALF_H) && car.y < (FINISH_Y + FINISH_HALF_H);
  var cooldownOk = (now - this.lastCrossTime) > MIN_LAP_TIME;

  // Arm the trigger once the car is clearly west of the finish line
  if (car.x < FINISH_X - 80) this.armed = true;

  // --- Lap crossing: car crosses x=FINISH_X going east while armed ---
  var crossed = this.armed && onTrack && car.x >= FINISH_X && cooldownOk;

  if (crossed) {
    if (this.lapCount > 0) {
      // Record the completed lap time
      this.lapTimes.push(this.currentLapMs);
      if (this.currentLapMs < this.bestLapMs) {
        this.bestLapMs = this.currentLapMs;
        this.bestLapFlashTimer = 2500;
      }
    }
    this.lapCount++;
    this.lapStartTime = now;
    this.currentLapMs = 0;
    this.lastCrossTime = now;
    this.armed = false;  // disarm until car goes west again
  }

  // --- Wrong-way detection: car crosses x=FINISH_X going west ---
  var wrongWay = onTrack && this.lastX !== null &&
                 this.lastX >= FINISH_X && car.x < FINISH_X &&
                 (now - this.lastWrongWayTime) > MIN_LAP_TIME;
  if (wrongWay) {
    this.wrongWayTimer    = 2500;
    this.lastWrongWayTime = now;
  }
  if (this.wrongWayTimer > 0) this.wrongWayTimer -= 16;

  this.lastX = car.x;
};

// Draw "WRONG WAY!" overlay when the car crosses the finish line backwards
Lap.prototype.drawWrongWay = function(ctx) {
  if (this.wrongWayTimer <= 0) return;
  var alpha = Math.min(1, this.wrongWayTimer / 500);
  ctx.save();
  ctx.globalAlpha   = alpha;
  ctx.fillStyle     = '#ff2020';
  ctx.font          = 'bold 62px Courier New';
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText('WRONG WAY!', 400, 200);
  ctx.globalAlpha   = 1;
  ctx.restore();
};

// Draw the checkered finish line as a vertical stripe on the track
// (kept for reference; not called in 3D mode — finish line rendered by Mode 7)
Lap.prototype.drawFinishLine = function(ctx) {
  var squareSize = 10;
  var stripeWidth = 8;
  var rows = Math.floor((FINISH_HALF_H * 2) / squareSize);
  var startX = FINISH_X - stripeWidth / 2;
  var startY = FINISH_Y - FINISH_HALF_H;

  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#000' : '#fff';
      ctx.fillRect(
        startX + col * (stripeWidth / 2),
        startY + row * squareSize,
        stripeWidth / 2,
        squareSize
      );
    }
  }
};

// Format milliseconds as M:SS.cc
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

// Draw the lap-time leaderboard (top-right, below HUD bar)
Lap.prototype.drawLeaderboard = function(ctx) {
  if (this.lapTimes.length === 0) return;
  var sorted = this.lapTimes.slice().sort(function(a, b) { return a - b; });
  var show   = sorted.slice(0, 5);
  var x = 784, y = 58, lineH = 20;

  ctx.save();
  ctx.fillStyle    = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x - 148, y - 4, 152, 18 + show.length * lineH);

  ctx.font         = 'bold 11px Courier New';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle    = '#fff';
  ctx.fillText('BEST LAPS', x, y);

  for (var i = 0; i < show.length; i++) {
    ctx.fillStyle = (i === 0) ? '#ffd700' : '#ccc';
    ctx.fillText((i + 1) + '.  ' + formatTime(show[i]), x, y + 16 + i * lineH);
  }
  ctx.restore();
};
