// car.js — Player car physics, input handling, and drawing

// --- Tuning constants (fun to experiment with!) ---
var MAX_SPEED      = 320;  // px/s — top speed on track
var ACCELERATION   = 85;   // px/s² — how fast the car speeds up
var BRAKING        = 160;  // px/s² — how fast the car slows down
var FRICTION       = 1.5;  // /s — natural speed decay when no key held
var TURN_SPEED     = 2.2;  // rad/s — steering sensitivity
var OFFTRACK_MULT  = 0.4;  // speed multiplier when off the track (grass)

function Car(x, y, angle, color) {
  this.x = x;
  this.y = y;
  this.angle = angle;   // radians, 0 = pointing right
  this.speed = 0;       // px/s, can be negative for reverse
  this.color = color || '#e94560';
  this.offTrack = false;
  this.width = 22;
  this.height = 12;
}

Car.prototype.update = function(dt, input, track) {
  // Turning — scale by speed fraction (min 0.3 so arrow keys always respond)
  var speedFraction = Math.max(0.3, Math.abs(this.speed) / MAX_SPEED);
  if (input.left)  this.angle -= TURN_SPEED * speedFraction * dt;
  if (input.right) this.angle += TURN_SPEED * speedFraction * dt;

  // Throttle and brake
  if (input.up)   this.speed += ACCELERATION * dt;
  if (input.down) this.speed -= BRAKING * dt;

  // Clamp speed
  var maxReverse = -MAX_SPEED * 0.4;
  if (this.speed > MAX_SPEED)  this.speed = MAX_SPEED;
  if (this.speed < maxReverse) this.speed = maxReverse;

  // Natural friction decay
  this.speed *= Math.pow(1 - FRICTION * dt, 1);
  if (Math.abs(this.speed) < 0.5) this.speed = 0;

  // Off-track penalty — check center and two front corners
  var frontX = this.x + Math.cos(this.angle) * this.width / 2;
  var frontY = this.y + Math.sin(this.angle) * this.width / 2;
  this.offTrack = !track.isOnTrack(frontX, frontY) || !track.isOnTrack(this.x, this.y);

  var effectiveSpeed = this.offTrack ? this.speed * OFFTRACK_MULT : this.speed;

  // Move the car
  this.x += Math.cos(this.angle) * effectiveSpeed * dt;
  this.y += Math.sin(this.angle) * effectiveSpeed * dt;

  // (no canvas-bounds clamp — world is larger than 800×600)
};

Car.prototype.draw = function(ctx, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha !== undefined ? alpha : 1;
  ctx.translate(this.x, this.y);
  ctx.rotate(this.angle);

  var w = this.width;
  var h = this.height;

  // Car body
  ctx.fillStyle = this.color;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Windshield stripe
  ctx.fillStyle = 'rgba(150, 220, 255, 0.7)';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 2, w * 0.35, h - 4);

  // Rear window
  ctx.fillStyle = 'rgba(150, 220, 255, 0.5)';
  ctx.fillRect(w / 2 - 7, -h / 2 + 2, 5, h - 4);

  // Wheels (4 small dark rectangles)
  ctx.fillStyle = '#222';
  ctx.fillRect(-w / 2 - 1, -h / 2 - 2, 5, 3);  // front-left
  ctx.fillRect(-w / 2 - 1,  h / 2 - 1, 5, 3);  // front-right
  ctx.fillRect( w / 2 - 4, -h / 2 - 2, 5, 3);  // rear-left
  ctx.fillRect( w / 2 - 4,  h / 2 - 1, 5, 3);  // rear-right

  ctx.restore();
};
