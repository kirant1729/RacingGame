// track.js — Track geometry, bitmap grid, and collision detection

var TRACK_HALF_W = 180;  // half-width of track in world units (track is 360 wide)

// Custom F1-style circuit — winding, non-oval, with chicanes, hairpin, and S-curves.
// World: 6000 × 5000 units.
// Main straight: heading east at y=1200, x: 800→3700.
// Finish line: x=1200, y=1200 (crossed west-to-east = clockwise lap).
var TRACK_WAYPOINTS = [
  // ── S/F area — long main straight heading east ──────────────────────────
  {x:  800, y: 1200},  //  0  final corner exit / before S/F
  {x: 1200, y: 1200},  //  1  FINISH LINE
  {x: 2000, y: 1200},  //  2
  {x: 2900, y: 1200},  //  3
  {x: 3700, y: 1200},  //  4  end of main straight
  // ── T1-T2: wide right sweeper turning south ──────────────────────────────
  {x: 4200, y: 1500},  //  5  T1 — sweeping right
  {x: 4500, y: 2000},  //  6  T1 exit — heading south
  // ── T3-T4: left-right chicane ────────────────────────────────────────────
  {x: 4200, y: 2300},  //  7  T3 — left flick
  {x: 4500, y: 2600},  //  8  T4 — right exit
  // ── T5: right-hand hairpin (south → west) ────────────────────────────────
  {x: 4500, y: 3000},  //  9  hairpin entry heading south
  {x: 4400, y: 3300},  // 10  hairpin apex
  {x: 4100, y: 3500},  // 11  hairpin turning west
  {x: 3600, y: 3500},  // 12  hairpin exit heading west
  // ── Back section — squiggly S-curves heading west ────────────────────────
  {x: 3200, y: 3300},  // 13  kink right
  {x: 2700, y: 3500},  // 14  kink left
  {x: 2200, y: 3300},  // 15  kink right
  {x: 1700, y: 3500},  // 16  kink left
  {x: 1300, y: 3300},  // 17  kink right — heading NW
  // ── T6: sweeping right turn heading north ────────────────────────────────
  {x: 1000, y: 2900},  // 18  T6 entry
  {x:  900, y: 2500},  // 19  T6 — heading north
  // ── T7-T8: S-curves ──────────────────────────────────────────────────────
  {x: 1200, y: 2100},  // 20  T7 — right
  {x:  800, y: 1700},  // 21  T8 — left
  {x:  800, y: 1400},  // 22  final straight approach
  // closes back to WP 0 (800, 1200)
];

// ─── Bitmap grid ─────────────────────────────────────────────────────────────
// World: 6000 × 5000 units.  Cell = 20 → grid 300 × 250 = 75 000 cells.
// Values: 0 = grass, 1 = curb, 2 = road, 3 = finish.
var GRID_CELL = 20;
var GRID_W    = 300;
var GRID_H    = 250;
var GRID      = new Uint8Array(GRID_W * GRID_H);

(function buildGrid() {
  var wps   = TRACK_WAYPOINTS;
  var n     = wps.length;
  var step  = GRID_CELL / 2;          // walk centerline in 10-unit steps
  var roadR = TRACK_HALF_W - 20;      // 160 — pure asphalt zone
  var curbR = TRACK_HALF_W;           // 180 — outer edge (curb 20 u wide)

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

  // Finish line strip — x ≈ 1200, y = 1200 ± 200 → value 3
  var fxMin = Math.max(0,          Math.floor(1180 / GRID_CELL));
  var fxMax = Math.min(GRID_W - 1, Math.floor(1220 / GRID_CELL));
  var fyMin = Math.max(0,          Math.floor(1000 / GRID_CELL));
  var fyMax = Math.min(GRID_H - 1, Math.floor(1400 / GRID_CELL));
  for (var gy2 = fyMin; gy2 <= fyMax; gy2++) {
    for (var gx2 = fxMin; gx2 <= fxMax; gx2++) {
      if (GRID[gy2 * GRID_W + gx2] >= 2) GRID[gy2 * GRID_W + gx2] = 3;
    }
  }
}());

// ─── Track API ───────────────────────────────────────────────────────────────
var TRACK_CONFIG = { cx: 500, cy: 400, outerRx: 440, outerRy: 320, innerRx: 280, innerRy: 200 };

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
