// track.js — Track geometry, bitmap grid, and collision detection

var TRACK_HALF_W = 140;  // half-width of track in world units (track is 280 wide)

// Simple NASCAR-style oval: two straights connected by two semicircles.
// Front straight: east (increasing x) at y=1200.
// Back  straight: west (decreasing x) at y=1700.
// Right semicircle: center (1800, 1450), radius 250 — connects front to back.
// Left  semicircle: center  (400, 1450), radius 250 — connects back to front.
// Finish line: x=500, y=1200 (crossed left-to-right = clockwise lap).
var TRACK_WAYPOINTS = [
  // Front straight (heading east, y=1200)
  {x:  400, y: 1200},  //  0  start / Turn 4 exit
  {x:  500, y: 1200},  //  1  FINISH LINE
  {x:  700, y: 1200},  //  2
  {x:  950, y: 1200},  //  3
  {x: 1200, y: 1200},  //  4
  {x: 1450, y: 1200},  //  5
  {x: 1650, y: 1200},  //  6  front straight end
  // Right semicircle (Turn 1 / Turn 2) — center (1800, 1450), r=250
  {x: 1800, y: 1200},  //  7  entry (angle −π/2)
  {x: 1977, y: 1273},  //  8  (angle −π/4)
  {x: 2050, y: 1450},  //  9  apex (angle 0)
  {x: 1977, y: 1627},  // 10  (angle +π/4)
  {x: 1800, y: 1700},  // 11  exit (angle +π/2)
  // Back straight (heading west, y=1700)
  {x: 1600, y: 1700},  // 12
  {x: 1350, y: 1700},  // 13
  {x: 1100, y: 1700},  // 14
  {x:  850, y: 1700},  // 15
  {x:  600, y: 1700},  // 16
  {x:  400, y: 1700},  // 17  back straight end
  // Left semicircle (Turn 3 / Turn 4) — center (400, 1450), r=250
  {x:  223, y: 1627},  // 18  (angle +3π/4)
  {x:  150, y: 1450},  // 19  apex (angle π)
  {x:  223, y: 1273},  // 20  (angle +5π/4)
  // closes back to WP 0 (400, 1200)
];

// ─── Bitmap grid ─────────────────────────────────────────────────────────────
// World: 2800 × 2400 units.  Cell = 20 → grid 140 × 120 = 16 800 cells.
// Values: 0 = grass, 1 = curb, 2 = road, 3 = finish.
var GRID_CELL = 20;
var GRID_W    = 140;
var GRID_H    = 120;
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

  // Finish line strip — x ≈ 500, y = 1200 ± 80 → value 3
  var fxMin = Math.max(0,          Math.floor(480 / GRID_CELL));
  var fxMax = Math.min(GRID_W - 1, Math.floor(520 / GRID_CELL));
  var fyMin = Math.max(0,          Math.floor(1120 / GRID_CELL));
  var fyMax = Math.min(GRID_H - 1, Math.floor(1280 / GRID_CELL));
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
