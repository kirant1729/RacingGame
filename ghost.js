// ghost.js — Three AI opponents following the oval centerline

// Uses TRACK_WAYPOINTS from track.js (loaded first).
// Speeds scaled for player MAX_SPEED = 600:
//   orange 300, purple 400, cyan 480 px/s
// Start positions evenly spaced at WP 0, 7, 14.
var AI_CONFIG = [
  { color: '#ff8c00', speed: 300, startWP:  0 },  // orange — easy
  { color: '#a855f7', speed: 400, startWP:  7 },  // purple — medium
  { color: '#22d3ee', speed: 480, startWP: 14 }   // cyan — challenging
];

function Ghost(config) {
  this.color   = config.color;
  this.speed   = config.speed;
  this.wpIndex = config.startWP % TRACK_WAYPOINTS.length;

  var wp    = TRACK_WAYPOINTS[this.wpIndex];
  this.x     = wp.x;
  this.y     = wp.y;
  this.angle = 0;
  this.width  = 22;
  this.height = 12;
}

Ghost.prototype.update = function(dt) {
  var wps    = TRACK_WAYPOINTS;
  var target = wps[this.wpIndex];
  var dx     = target.x - this.x;
  var dy     = target.y - this.y;

  if (Math.sqrt(dx * dx + dy * dy) < 25) {
    this.wpIndex = (this.wpIndex + 1) % wps.length;
    target = wps[this.wpIndex];
    dx = target.x - this.x;
    dy = target.y - this.y;
  }

  this.angle = Math.atan2(dy, dx);
  this.x += Math.cos(this.angle) * this.speed * dt;
  this.y += Math.sin(this.angle) * this.speed * dt;
};

Ghost.prototype.draw = function(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.translate(this.x, this.y);
  ctx.rotate(this.angle);

  var w = this.width, h = this.height;
  ctx.fillStyle = this.color;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  ctx.fillStyle = 'rgba(150,220,255,0.6)';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 2, w * 0.35, h - 4);

  ctx.fillStyle = '#222';
  ctx.fillRect(-w / 2 - 1, -h / 2 - 2, 5, 3);
  ctx.fillRect(-w / 2 - 1,  h / 2 - 1, 5, 3);
  ctx.fillRect( w / 2 - 4, -h / 2 - 2, 5, 3);
  ctx.fillRect( w / 2 - 4,  h / 2 - 1, 5, 3);

  ctx.restore();
};

var ghosts = AI_CONFIG.map(function(cfg) { return new Ghost(cfg); });
