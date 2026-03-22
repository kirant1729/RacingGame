// ghost.js — Three AI opponents that follow a fixed waypoint path around the track

// Waypoints sample the oval center line evenly (midpoint between inner and outer ellipses)
// Oval center: (400, 300), outer radii: (340, 220), inner radii: (210, 130)
// Center-line radii: outerR - (outerR - innerR)/2 => rx~275, ry~175
var AI_WAYPOINTS = (function() {
  var cx = 400, cy = 300;
  var rx = 275, ry = 175;
  var points = [];
  var count = 24;
  for (var i = 0; i < count; i++) {
    // Start from the bottom of the oval (angle = PI/2) and go clockwise
    var angle = (Math.PI / 2) + (i / count) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry
    });
  }
  return points;
}());

// AI opponent config: color, speed (px/s), starting waypoint index offset
var AI_CONFIG = [
  { color: '#ff8c00', speed: 155, startWP: 4  },  // orange
  { color: '#a855f7', speed: 168, startWP: 12 },  // purple
  { color: '#22d3ee', speed: 180, startWP: 20 }   // cyan
];

function Ghost(config) {
  this.color = config.color;
  this.speed = config.speed;
  this.wpIndex = config.startWP % AI_WAYPOINTS.length;

  // Start at the waypoint position
  var wp = AI_WAYPOINTS[this.wpIndex];
  this.x = wp.x;
  this.y = wp.y;
  this.angle = 0;
  this.width = 22;
  this.height = 12;
}

Ghost.prototype.update = function(dt) {
  var target = AI_WAYPOINTS[this.wpIndex];
  var dx = target.x - this.x;
  var dy = target.y - this.y;
  var dist = Math.sqrt(dx * dx + dy * dy);

  // Advance to the next waypoint when close enough
  if (dist < 20) {
    this.wpIndex = (this.wpIndex + 1) % AI_WAYPOINTS.length;
    target = AI_WAYPOINTS[this.wpIndex];
    dx = target.x - this.x;
    dy = target.y - this.y;
  }

  // Steer toward the waypoint
  this.angle = Math.atan2(dy, dx);

  // Move at fixed speed
  this.x += Math.cos(this.angle) * this.speed * dt;
  this.y += Math.sin(this.angle) * this.speed * dt;
};

Ghost.prototype.draw = function(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.translate(this.x, this.y);
  ctx.rotate(this.angle);

  var w = this.width;
  var h = this.height;

  // Car body
  ctx.fillStyle = this.color;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Windshield
  ctx.fillStyle = 'rgba(150, 220, 255, 0.6)';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 2, w * 0.35, h - 4);

  // Wheels
  ctx.fillStyle = '#222';
  ctx.fillRect(-w / 2 - 1, -h / 2 - 2, 5, 3);
  ctx.fillRect(-w / 2 - 1,  h / 2 - 1, 5, 3);
  ctx.fillRect( w / 2 - 4, -h / 2 - 2, 5, 3);
  ctx.fillRect( w / 2 - 4,  h / 2 - 1, 5, 3);

  ctx.restore();
};

// Create the three AI opponents
var ghosts = AI_CONFIG.map(function(cfg) {
  return new Ghost(cfg);
});
