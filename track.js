// track.js — Track geometry, bitmap grid, and collision detection

var TRACK_HALF_W = 70;   // half-width of track in world units (track is 140 wide)

// Monza-inspired 40-point centerline, clockwise on screen.
// Main straight runs east (increasing x) at y=1200.
// Finish line at x=500, y=1200 — crossed left-to-right (west→east).
var TRACK_WAYPOINTS = [
  // Main straight (heading east, y=1200)
  {x: 200,  y: 1200},  //  0  west end / Parabolica exit
  {x: 500,  y: 1200},  //  1  finish line
  {x: 800,  y: 1200},  //  2
  {x: 1100, y: 1200},  //  3
  {x: 1400, y: 1200},  //  4
  {x: 1700, y: 1200},  //  5  east end

  // Curva Grande — big right sweeper heading south
  {x: 1880, y: 1280},  //  6
  {x: 1980, y: 1420},  //  7
  {x: 2020, y: 1580},  //  8
  {x: 2000, y: 1740},  //  9
  {x: 1920, y: 1870},  // 10

  // Roggia chicane — south-west
  {x: 1800, y: 1950},  // 11
  {x: 1670, y: 2000},  // 12  right apex
  {x: 1540, y: 1990},  // 13
  {x: 1420, y: 1950},  // 14  left apex
  {x: 1300, y: 1880},  // 15

  // Lesmo 1 — right turn, heading north (decreasing y)
  {x: 1200, y: 1800},  // 16
  {x: 1150, y: 1700},  // 17
  {x: 1170, y: 1600},  // 18  apex
  {x: 1230, y: 1510},  // 19

  // Between Lesmos
  {x: 1310, y: 1450},  // 20
  {x: 1390, y: 1400},  // 21

  // Lesmo 2 — right turn
  {x: 1440, y: 1320},  // 22
  {x: 1420, y: 1240},  // 23  apex
  {x: 1360, y: 1170},  // 24

  // Toward Ascari
  {x: 1270, y: 1100},  // 25
  {x: 1170, y: 1050},  // 26

  // Ascari chicane — left then right
  {x: 1060, y: 1030},  // 27  left turn
  {x: 960,  y: 1060},  // 28
  {x: 900,  y: 1130},  // 29  right turn
  {x: 860,  y: 1210},  // 30

  // Parabolica — long right sweeper back to main straight
  {x: 820,  y: 1340},  // 31
  {x: 760,  y: 1480},  // 32
  {x: 660,  y: 1600},  // 33
  {x: 540,  y: 1680},  // 34
  {x: 420,  y: 1700},  // 35  apex
  {x: 310,  y: 1660},  // 36
  {x: 240,  y: 1560},  // 37
  {x: 210,  y: 1440},  // 38
  {x: 200,  y: 1320},  // 39
  // closes back to WP 0 (200, 1200)
];

// ─── Bitmap grid (pre-computed once at load) ────────────────────────────────
// World: 2800 × 2400 units.  Cell size = 20 → grid 140 × 120 = 16 800 cells.
// Values: 0 = grass, 1 = curb, 2 = road, 3 = finish line.
var GRID_CELL = 20;
var GRID_W    = 140;
var GRID_H    = 120;
var GRID      = new Uint8Array(GRID_W * GRID_H);

(function buildGrid() {
  var wps   = TRACK_WAYPOINTS;
  var n     = wps.length;
  var step  = GRID_CELL / 2;       // walk centerline in 10-unit steps
  var roadR = TRACK_HALF_W - 15;   // pure road zone radius
  var curbR = TRACK_HALF_W;        // outer curb edge radius

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
          GRID[idx] = 2;                          // road (highest priority)
        } else if (d <= curbR && GRID[idx] < 2) {
          GRID[idx] = 1;                          // curb (only if not road)
        }
      }
    }
  }

  for (var i = 0; i < n; i++) {
    var a  = wps[i];
    var b  = wps[(i + 1) % n];
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.ceil(len / step));
    for (var s = 0; s <= steps; s++) {
      var t = s / steps;
      markDisc(a.x + dx * t, a.y + dy * t);
    }
  }

  // Mark finish line strip (x ≈ 500, y = 1200 ± 80) as value 3
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

// Kept for backward-compat with game.js constructor call (values unused)
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

// draw() is a no-op in 3D mode (Mode 7 renders the ground)
Track.prototype.draw = function(ctx) {
  ctx.fillStyle = '#3a6b35';
  ctx.fillRect(0, 0, 800, 600);
};
