// ghost.js — Three AI opponents that follow the track centerline

// AI opponents use the same waypoint list as the track centerline.
// TRACK_WAYPOINTS is defined in track.js (loaded before this file).
var AI_CONFIG = [
  { color: '#ff8c00', speed:  80, startWP:  0 },  // orange — easy
  { color: '#a855f7', speed: 105, startWP: 13 },  // purple — medium
  { color: '#22d3ee', speed: 130, startWP: 26 }   // cyan — challenging
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
  var dist   = Math.sqrt(dx * dx + dy * dy);

  if (dist < 25) {
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
