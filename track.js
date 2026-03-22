// track.js — Track geometry, rendering, and collision detection

var TRACK_CONFIG = {
  cx: 400, cy: 300,          // center of the canvas
  outerRx: 340, outerRy: 220, // outer ellipse radii
  innerRx: 210, innerRy: 130  // inner ellipse radii (the grass hole)
};

function Track(config) {
  this.cx = config.cx;
  this.cy = config.cy;
  this.outerRx = config.outerRx;
  this.outerRy = config.outerRy;
  this.innerRx = config.innerRx;
  this.innerRy = config.innerRy;
}

// Returns true if point (x, y) is on the asphalt portion of the track
Track.prototype.isOnTrack = function(x, y) {
  var dx = x - this.cx;
  var dy = y - this.cy;
  var insideOuter = (dx * dx) / (this.outerRx * this.outerRx) +
                    (dy * dy) / (this.outerRy * this.outerRy) <= 1;
  var insideInner = (dx * dx) / (this.innerRx * this.innerRx) +
                    (dy * dy) / (this.innerRy * this.innerRy) <= 1;
  return insideOuter && !insideInner;
};

// Draw the full track onto the canvas context
Track.prototype.draw = function(ctx) {
  // --- Grass background (whole canvas) ---
  ctx.fillStyle = '#3a6b35';
  ctx.fillRect(0, 0, 800, 600);

  // --- Asphalt ring using evenodd fill rule ---
  ctx.save();
  ctx.fillStyle = '#555';
  ctx.beginPath();
  // Outer ellipse
  ctx.ellipse(this.cx, this.cy, this.outerRx, this.outerRy, 0, 0, Math.PI * 2);
  // Inner ellipse (punches a hole)
  ctx.ellipse(this.cx, this.cy, this.innerRx, this.innerRy, 0, 0, Math.PI * 2);
  ctx.fill('evenodd');
  ctx.restore();

  // --- Inner grass (fills the center hole with a nicer color) ---
  ctx.save();
  ctx.fillStyle = '#4a7c45';
  ctx.beginPath();
  ctx.ellipse(this.cx, this.cy, this.innerRx - 2, this.innerRy - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- White outer edge line ---
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 12]);
  ctx.beginPath();
  ctx.ellipse(this.cx, this.cy, this.outerRx - 8, this.outerRy - 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- White inner edge line ---
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 12]);
  ctx.beginPath();
  ctx.ellipse(this.cx, this.cy, this.innerRx + 8, this.innerRy + 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};
