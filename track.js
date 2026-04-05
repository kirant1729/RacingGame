// track.js — Track geometry, bitmap grid, and collision detection

var TRACK_HALF_W = 140;  // half-width of track in world units (track is 280 wide)

// NASCAR-style oval — bigger and longer than before.
// Front straight: east (increasing x) at y=1000, x: 600→2600.
// Back  straight: west (decreasing x) at y=2000, x: 600→2600.
// Right semicircle: center (2600, 1500), radius 500.
// Left  semicircle: center  (600, 1500), radius 500.
// Finish line: x=700, y=1000 (crossed left-to-right = clockwise lap).
var TRACK_WAYPOINTS = [
  // Front straight (heading east, y=1000)
  {x:  600, y: 1000},  //  0  Turn 4 exit / start
  {x:  700, y: 1000},  //  1  FINISH LINE
  {x: 1000, y: 1000},  //  2
  {x: 1400, y: 1000},  //  3
  {x: 1800, y: 1000},  //  4
  {x: 2200, y: 1000},  //  5
  {x: 2600, y: 1000},  //  6  front straight end / T1 entry
  // Right semicircle (Turn 1 / Turn 2) — center (2600, 1500), r=500
  {x: 2954, y: 1146},  //  7  angle = −π/4
  {x: 3100, y: 1500},  //  8  apex (angle = 0)
  {x: 2954, y: 1854},  //  9  angle = +π/4
  {x: 2600, y: 2000},  // 10  T2 exit (angle = +π/2)
  // Back straight (heading west, y=2000)
  {x: 2200, y: 2000},  // 11
  {x: 1800, y: 2000},  // 12
  {x: 1400, y: 2000},  // 13
  {x: 1000, y: 2000},  // 14
  {x:  600, y: 2000},  // 15  back straight end / T3 entry
  // Left semicircle (Turn 3 / Turn 4) — center (600, 1500), r=500
  {x:  246, y: 1854},  // 16  angle = +3π/4
  {x:  100, y: 1500},  // 17  apex (angle = π)
  {x:  246, y: 1146},  // 18  angle = +5π/4
  // closes back to WP 0 (600, 1000)
];

// ─── Bitmap grid ─────────────────────────────────────────────────────────────
// World: 3600 × 3000 units.  Cell = 20 → grid 180 × 150 = 27 000 cells.
// Values: 0 = grass, 1 = curb, 2 = road, 3 = finish.
var GRID_CELL = 20;
var GRID_W    = 180;
var GRID_H    = 150;
var GRID      = new Uint8Array(GRID_W * GRID_H);

(function buildGrid() {
  var wps   = TRACK_WAYPOINTS;
  var n     = wps.length;
  var step  = GRID_CELL / 2;          // walk centerline in 10-unit steps
  var roadR = TRACK_HALF_W - 20;      // 120 — pure asphalt zone
  var curbR = TRACK_HALF_W;           // 140 — outer edge (curb 20 u wide)

  function markDisc(cx, cy) {
    var minGx = Math.max(0,          Math.floor((cx - curbR) / GRID_CELL));
    var maxGx = Math.min(GRID_W - 1, Math.floor((cx + curbR) / GRID_CELL));
    var minGy = Math.max(0,          Math.floor((cy - curbR) / GRID_CELL));
    var maxGy = Math.min(GRID_H - 1, Math.floor((cy + curbR) / GRID_CELL));
    for (var gy = minGy; gy <= maxGy; gy++) {
      for (var gx = minGx; gx <= maxGx; gx++) {
        var wx  = gx * GRID_CELL + GRID_CELL / 2;
        var wy  = gy * GRID_CELL + GRID_CELL / 2;
        var d   = Math.sqrt((wx - cx) * (wx - cx) + (wy - cy) * (wy - cy));
        var idx = gy * GRID_W + gx;
        if (d <= roadR) {
          GRID[idx] = 2;
        } else if (d <= curbR && GRID[idx] < 2) {
          GRID[idx] = 1;
        }
      }
    }
  }

  for (var i = 0; i < n; i++) {
    var a   = wps[i];
    var b   = wps[(i + 1) % n];
    var dx  = b.x - a.x, dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.ceil(len / step));
    for (var s = 0; s <= steps; s++) {
      var t = s / steps;
      markDisc(a.x + dx * t, a.y + dy * t);
    }
  }

  // Finish line strip — x ≈ 700, y = 1000 ± 80 → value 3
  var fxMin = Math.max(0,          Math.floor(680 / GRID_CELL));
  var fxMax = Math.min(GRID_W - 1, Math.floor(720 / GRID_CELL));
  var fyMin = Math.max(0,          Math.floor(920 / GRID_CELL));
  var fyMax = Math.min(GRID_H - 1, Math.floor(1080 / GRID_CELL));
  for (var gy2 = fyMin; gy2 <= fyMax; gy2++) {
    for (var gx2 = fxMin; gx2 <= fxMax; gx2++) {
      if (GRID[gy2 * GRID_W + gx2] >= 2) GRID[gy2 * GRID_W + gx2] = 3;
    }
  }
}());

// ─── Track API ───────────────────────────────────────────────────────────────
var TRACK_CONFIG = { cx: 400, cy: 300, outerRx: 340, outerRy: 220, innerRx: 210, innerRy: 130 };

function Track() {}

Track.prototype.getCell = function(wx, wy) {
  var gx = wx / GRID_CELL | 0;
  var gy = wy / GRID_CELL | 0;
  if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return 0;
  return GRID[gy * GRID_W + gx];
};

Track.prototype.isOnTrack = function(wx, wy) {
  return this.getCell(wx, wy) >= 2;
};

Track.prototype.draw = function() {};
