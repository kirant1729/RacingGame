// car.js — Player car physics, input handling, and drawing

// --- Tuning constants ---
var MAX_SPEED      = 600;  // px/s — top speed on track
var ACCELERATION   = 150;  // px/s² — how fast the car speeds up
var BRAKING        = 300;  // px/s² — how fast the car slows down
var FRICTION       = 0.25; // /s — natural speed decay when no key held
var TURN_SPEED     = 2.0;  // rad/s — steering sensitivity
var OFFTRACK_MULT  = 0.9;  // speed multiplier on grass (only 10% slower)

function Car(x, y, angle, color) {
  this.x     = x;
  this.y     = y;
  this.angle = angle;   // radians, 0 = pointing right (east)
  this.speed = 0;       // px/s
  this.color = color || '#e94560';
  this.offTrack    = false;
  this.width       = 22;
  this.height      = 12;
  this.rampCooldown = 0;  // seconds remaining before another ramp boost can trigger
}

Car.prototype.update = function(dt, input, track) {
  // Tick ramp cooldown
  if (this.rampCooldown > 0) this.rampCooldown -= dt;

  // Turning — scale by speed fraction (min 0.3 so low-speed steering still works)
  var speedFraction = Math.max(0.3, Math.abs(this.speed) / MAX_SPEED);
  if (input.left)  this.angle -= TURN_SPEED * speedFraction * dt;
  if (input.right) this.angle += TURN_SPEED * speedFraction * dt;

  // Throttle and brake
  if (input.up)   this.speed += ACCELERATION * dt;
  if (input.down) this.speed -= BRAKING * dt;

  // Speed clamp
  var maxReverse = -MAX_SPEED * 0.4;
  if (this.speed > MAX_SPEED)  this.speed = MAX_SPEED;
  if (this.speed < maxReverse) this.speed = maxReverse;

  // Natural friction decay
  this.speed *= Math.pow(1 - FRICTION * dt, 1);
  if (Math.abs(this.speed) < 0.5) this.speed = 0;

  // Off-track check — center and front tip
  var frontX = this.x + Math.cos(this.angle) * this.width / 2;
  var frontY = this.y + Math.sin(this.angle) * this.width / 2;
  this.offTrack = !track.isOnTrack(frontX, frontY) || !track.isOnTrack(this.x, this.y);

  var effectiveSpeed = this.offTrack ? this.speed * OFFTRACK_MULT : this.speed;

  this.x += Math.cos(this.angle) * effectiveSpeed * dt;
  this.y += Math.sin(this.angle) * effectiveSpeed * dt;
  // (no canvas-bounds clamp — world is larger than 800×600)
};

// ─── Drawing (top-down, used by minimap / debug only — 3D mode uses drawOpponents) ───
Car.prototype.draw = function(ctx, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha !== undefined ? alpha : 1;
  ctx.translate(this.x, this.y);
  ctx.rotate(this.angle);

  var w = this.width, h = this.height;

  // Body
  ctx.fillStyle = this.color;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Windshield
  ctx.fillStyle = 'rgba(150,220,255,0.7)';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 2, w * 0.35, h - 4);

  // Rear window
  ctx.fillStyle = 'rgba(150,220,255,0.5)';
  ctx.fillRect(w / 2 - 7, -h / 2 + 2, 5, h - 4);

  // Wheels
  ctx.fillStyle = '#222';
  ctx.fillRect(-w / 2 - 1, -h / 2 - 2, 5, 3);
  ctx.fillRect(-w / 2 - 1,  h / 2 - 1, 5, 3);
  ctx.fillRect( w / 2 - 4, -h / 2 - 2, 5, 3);
  ctx.fillRect( w / 2 - 4,  h / 2 - 1, 5, 3);

  ctx.restore();
};
