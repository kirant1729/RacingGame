// game.js — Main game loop, Mode 7 pseudo-3D, third-person camera

var canvas = document.getElementById('gameCanvas');
var ctx    = canvas.getContext('2d');
var W      = canvas.width;   // 800
var H      = canvas.height;  // 600

// --- Mode 7 rendering constants ---
var HORIZON    = 290;
var CAM_HEIGHT = 80;
var FOCAL_LEN  = 250;
var CAM_BEHIND = 150;   // world units behind the car

// --- Game state ---
var STATE_START     = 'start';
var STATE_COUNTDOWN = 'countdown';
var STATE_PLAYING   = 'playing';
var STATE_PAUSED    = 'paused';
var STATE_RACE_OVER = 'raceover';
var gameState       = STATE_START;
var countdownStart  = 0;
var RACE_LAPS         = 4;
var raceOverDismissed = false;
var wallHitTimer      = 0;    // ms — how long brake lights flash after wall hit
var wallBeepCooldown  = 0;    // ms — prevents beep firing every frame during collision
var carTilt           = 0;    // radians — current lean angle when cornering

// --- Game objects ---
var track  = new Track(TRACK_CONFIG);
var player = new Car(1500, 1200, 0, '#e94560');
var lap    = new Lap();

// --- Camera ---
var cam = { x: 0, y: 0, angle: 0 };

function updateCamera() {
  cam.angle = player.angle;
  cam.x     = player.x - Math.cos(player.angle) * CAM_BEHIND;
  cam.y     = player.y - Math.sin(player.angle) * CAM_BEHIND;
}

// --- Input ---
var keys = { up: false, down: false, left: false, right: false };

document.addEventListener('keydown', function(e) {
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': keys.up    = true;  e.preventDefault(); break;
    case 'ArrowDown':  case 's': case 'S': keys.down  = true;  e.preventDefault(); break;
    case 'ArrowLeft':  case 'a': case 'A': keys.left  = true;  e.preventDefault(); break;
    case 'ArrowRight': case 'd': case 'D': keys.right = true;  e.preventDefault(); break;
    case ' ':
      if (gameState === STATE_START) {
        gameState = STATE_COUNTDOWN;
        countdownStart = performance.now();
        SoundSystem.init();
      } else if (gameState === STATE_RACE_OVER) {
        gameState = STATE_PLAYING;
        raceOverDismissed = true;
      }
      e.preventDefault();
      break;
    case 'r': case 'R':
      if (gameState === STATE_RACE_OVER) {
        player.x = 800; player.y = 1000; player.angle = 0; player.speed = 0;
        lap.reset();
        raceOverDismissed = false;
        gameState = STATE_COUNTDOWN;
        countdownStart = performance.now();
      }
      break;
    case 'p': case 'P':
      if (gameState === STATE_PLAYING)      gameState = STATE_PAUSED;
      else if (gameState === STATE_PAUSED)  gameState = STATE_PLAYING;
      break;
  }
});
document.addEventListener('keyup', function(e) {
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': keys.up    = false; break;
    case 'ArrowDown':  case 's': case 'S': keys.down  = false; break;
    case 'ArrowLeft':  case 'a': case 'A': keys.left  = false; break;
    case 'ArrowRight': case 'd': case 'D': keys.right = false; break;
  }
});

// ─────────────────────────────────────────────
// Stars
// ─────────────────────────────────────────────
var STARS = (function () {
  var a = [];
  for (var i = 0; i < 200; i++) {
    a.push({ x: Math.random()*W, y: Math.random()*(HORIZON-30),
             r: Math.random()<0.12?1.4:0.6, a: 0.3+Math.random()*0.7 });
  }
  return a;
}());

// ─────────────────────────────────────────────
// City skyline
// ─────────────────────────────────────────────
var NEON_COLS = ['#00ffff','#ff00ff','#ff6600','#00ff88','#ffff00','#ff2266'];
var DARK_COLS = ['#070c18','#0a1020','#060810','#0c1428','#080a14'];

var CITY = (function () {
  var arr = [];
  for (var i = 0; i < 120; i++) {
    var h=38+Math.random()*200, w=16+Math.random()*44;
    var wRows=Math.max(1,Math.floor(h/18)), wCols=Math.max(1,Math.floor(w/9));
    var wins=[];
    for (var r=0;r<wRows;r++){wins.push([]);for(var c=0;c<wCols;c++)wins[r].push(Math.random()>0.35);}
    arr.push({ angle:(i/120)*Math.PI*2, h:h, w:w,
               color:DARK_COLS[i%DARK_COLS.length], neon:NEON_COLS[i%NEON_COLS.length],
               wRows:wRows, wCols:wCols, wins:wins,
               hasSpire:Math.random()>0.55, spireH:12+Math.random()*50 });
  }
  return arr;
}());

// Pre-allocated road ImageData
var roadImg = ctx.createImageData(W, H - HORIZON);

// ─────────────────────────────────────────────
// Speed-boost ramps
// ─────────────────────────────────────────────
var OBSTACLES = [
  // Speed-boost ramps on the main straight and back section
  {x:2000,y:1200,r:12},{x:2900,y:1200,r:12},
  {x:2700,y:3500,r:12},{x:2200,y:3300,r:12},
];

// ─────────────────────────────────────────────
// Background: sky + stars + city
// ─────────────────────────────────────────────
function drawBackground() {
  var sg = ctx.createLinearGradient(0,0,0,HORIZON);
  sg.addColorStop(0,'#000008'); sg.addColorStop(0.6,'#06062c'); sg.addColorStop(1,'#1a0840');
  ctx.fillStyle=sg; ctx.fillRect(0,0,W,HORIZON);

  for (var i=0;i<STARS.length;i++) {
    var s=STARS[i]; ctx.globalAlpha=s.a; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;

  var hg=ctx.createLinearGradient(0,HORIZON-90,0,HORIZON);
  hg.addColorStop(0,'rgba(40,0,100,0)'); hg.addColorStop(1,'rgba(100,30,220,0.4)');
  ctx.fillStyle=hg; ctx.fillRect(0,HORIZON-90,W,90);

  var normA=((cam.angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
  var FOV=Math.PI*0.72, pxR=W/FOV;
  for (var j=0;j<CITY.length;j++) {
    var b=CITY[j], da=b.angle-normA;
    if(da>Math.PI)da-=Math.PI*2; if(da<-Math.PI)da+=Math.PI*2;
    if(Math.abs(da)>FOV*0.58)continue;
    var bx=Math.round(W/2+da*pxR), bTop=HORIZON-b.h;
    ctx.fillStyle=b.color; ctx.fillRect(bx-b.w/2,bTop,b.w,b.h);
    ctx.strokeStyle=b.neon; ctx.lineWidth=1;
    ctx.strokeRect(bx-b.w/2+0.5,bTop+0.5,b.w-1,b.h-1);
    if(b.hasSpire){ctx.strokeStyle=b.neon;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(bx,bTop);ctx.lineTo(bx,bTop-b.spireH);ctx.stroke();}
    var ww=Math.max(2,b.w/b.wCols-2);
    for(var rr=0;rr<b.wRows;rr++)for(var cc=0;cc<b.wCols;cc++)
      if(b.wins[rr][cc]){ctx.fillStyle='rgba(255,220,80,0.65)';ctx.fillRect(bx-b.w/2+2+cc*(b.w/b.wCols),bTop+4+rr*18,ww,11);}
  }
}

// ─────────────────────────────────────────────
// Mode 7 scanline road
// ─────────────────────────────────────────────
function drawRoad() {
  var px=roadImg.data, cosA=Math.cos(cam.angle), sinA=Math.sin(cam.angle);
  for (var row=0;row<H-HORIZON;row+=2) {
    var rowFH=row+1, depth=CAM_HEIGHT*FOCAL_LEN/rowFH, dof=depth/FOCAL_LEN;
    var wxL=cam.x+cosA*depth+sinA*(W/2)*dof, wyL=cam.y+sinA*depth-cosA*(W/2)*dof;
    var wxS=-sinA*dof, wyS=cosA*dof, band=(Math.floor(depth/60)&1);
    var wx=wxL,wy=wyL;
    for (var col=0;col<W;col+=2) {
      var r,g,b;
      var gx=wx/GRID_CELL|0, gy=wy/GRID_CELL|0;
      var cell=(gx>=0&&gx<GRID_W&&gy>=0&&gy<GRID_H)?GRID[gy*GRID_W+gx]:0;
      if(cell===3){var fc=(((wx/10|0)+(wy/10|0))&1);if(fc){r=255;g=255;b=255;}else{r=0;g=0;b=0;}}
      else if(cell===2){if(band){r=82;g=82;b=88;}else{r=66;g=66;b=72;}}
      else if(cell===1){var cb=((Math.floor(wx/12)^Math.floor(wy/12))&1);if(cb){r=210;g=18;b=18;}else{r=235;g=235;b=235;}}
      else{var chk=((Math.floor(wx/50)^Math.floor(wy/50))&1);if(chk){r=42;g=88;b=40;}else{r=54;g=108;b=50;}}
      var i00=(row*W+col)*4,i01=i00+4,i10=i00+W*4,i11=i10+4;
      px[i00]=px[i01]=px[i10]=px[i11]=r;
      px[i00+1]=px[i01+1]=px[i10+1]=px[i11+1]=g;
      px[i00+2]=px[i01+2]=px[i10+2]=px[i11+2]=b;
      px[i00+3]=px[i01+3]=px[i10+3]=px[i11+3]=255;
      wx+=wxS*2; wy+=wyS*2;
    }
  }
  ctx.putImageData(roadImg,0,HORIZON);
}

// ─────────────────────────────────────────────
// Armco barrier walls
// ─────────────────────────────────────────────
function drawWalls() {
  var cosA = Math.cos(cam.angle), sinA = Math.sin(cam.angle);
  for (var col = 0; col < W; col += 2) {
    var prevCell = -1;
    for (var row = 0; row < H - HORIZON + 200; row += 2) {
      var rowFH = row + 1;
      var depth = CAM_HEIGHT * FOCAL_LEN / rowFH;
      var dof   = depth / FOCAL_LEN;
      var lat   = (col - W / 2) * dof;
      var wx    = cam.x + cosA * depth - sinA * lat;
      var wy    = cam.y + sinA * depth + cosA * lat;
      var cell  = track.getCell(wx, wy);
      if (prevCell >= 1 && cell === 0) {
        var screenY  = Math.min(HORIZON + row, H);
        var faceH    = Math.min(screenY - HORIZON, 18);   // capped — shorter wall
        var wallH    = Math.max(8, CAM_HEIGHT * 1.0 * FOCAL_LEN / depth);
        // Concrete wall face (short, thick block)
        ctx.fillStyle = '#6c6c78';
        ctx.fillRect(col, screenY - faceH, 4, faceH);
        // Blue/green alternating Armco stripe at base
        var stripe = (Math.floor(depth / 120) & 1);
        ctx.fillStyle = stripe ? '#cc2222' : '#eeeeee';
        ctx.fillRect(col, screenY - wallH, 4, wallH);
        break;
      }
      prevCell = cell;
    }
  }
}

// ─────────────────────────────────────────────
// Speed-boost ramps (3D wedge)
// ─────────────────────────────────────────────
function drawObstacles() {
  var cosA=Math.cos(cam.angle),sinA=Math.sin(cam.angle);
  for (var i=0;i<OBSTACLES.length;i++) {
    var obs=OBSTACLES[i],dx=obs.x-cam.x,dy=obs.y-cam.y;
    var fwd=dx*cosA+dy*sinA; if(fwd<10)continue;
    var lat=-dx*sinA+dy*cosA;
    var sx=W/2+lat*FOCAL_LEN/fwd, sy=HORIZON+CAM_HEIGHT*FOCAL_LEN/fwd, sc=FOCAL_LEN/fwd;
    var sw=Math.max(6,obs.r*2.5*sc), sh=Math.max(4,obs.r*2.0*sc);
    if(sx<-sw||sx>W+sw||sy>H)continue;
    ctx.fillStyle='#ff6600';
    ctx.beginPath();ctx.moveTo(sx-sw/2,sy);ctx.lineTo(sx+sw/2,sy);
    ctx.lineTo(sx+sw/2,sy-sh*0.5);ctx.lineTo(sx,sy-sh);ctx.lineTo(sx-sw/2,sy-sh*0.5);
    ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffee00';
    ctx.beginPath();ctx.moveTo(sx-sw*0.25,sy-sh*0.4);ctx.lineTo(sx+sw*0.25,sy-sh*0.4);
    ctx.lineTo(sx,sy-sh*0.9);ctx.closePath();ctx.fill();
  }
}

// ─────────────────────────────────────────────
// Player car — futuristic rocket racer, rear view
// No wheels: twin side thruster pods + central main nozzle
// Driver visible through a glowing bubble canopy
// ─────────────────────────────────────────────
function drawPlayerCar3D() {
  var cosA = Math.cos(cam.angle), sinA = Math.sin(cam.angle);
  var dx  = player.x - cam.x, dy = player.y - cam.y;
  var fwd = dx * cosA + dy * sinA, lat = -dx * sinA + dy * cosA;
  if (fwd < 10) return;

  var sx = W/2 + lat * FOCAL_LEN / fwd;
  var sc = FOCAL_LEN / fwd;
  var sy = HORIZON + CAM_HEIGHT * FOCAL_LEN / fwd;

  // Animation timers
  var now     = Date.now() / 1000;
  var flicker = 0.78 + Math.sin(now * 38) * 0.22;   // flame flicker
  var bob     = Math.sin(now * 2.8) * 2.8 * sc;     // hover bob

  var bx  = sx;
  var cw  = Math.max(20, 64 * sc);
  var ch  = Math.max(10, 34 * sc);
  var by  = sy - ch * 0.5 + bob;   // lift car so full body sits above road surface
  var col = player.color;

  // Apply cornering tilt around car centre
  ctx.save();
  ctx.translate(bx, by - ch * 0.5);
  ctx.rotate(carTilt);
  ctx.translate(-bx, -(by - ch * 0.5));

  // ── HOVER GLOW under car (ambient levitation light) ─────────────────────
  var hg = ctx.createRadialGradient(bx, by, 0, bx, by + ch*0.15, cw * 0.72);
  hg.addColorStop(0, 'rgba(0,180,255,0.45)');
  hg.addColorStop(0.55, 'rgba(0,100,255,0.15)');
  hg.addColorStop(1, 'rgba(0,50,200,0)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(bx, by + ch*0.08, cw * 0.68, ch * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── CENTRAL MAIN ROCKET FLAME ────────────────────────────────────────────
  var cfH = ch * 0.60 * flicker;
  var cfG = ctx.createLinearGradient(bx, by - ch*0.04, bx, by + cfH);
  cfG.addColorStop(0,    'rgba(255,255,255,1)');
  cfG.addColorStop(0.12, 'rgba(140,220,255,0.95)');
  cfG.addColorStop(0.5,  'rgba(20,100,255,0.55)');
  cfG.addColorStop(1,    'rgba(0,0,200,0)');
  ctx.fillStyle = cfG;
  ctx.beginPath();
  ctx.moveTo(bx - cw*0.13, by - ch*0.04);
  ctx.lineTo(bx + cw*0.13, by - ch*0.04);
  ctx.quadraticCurveTo(bx + cw*0.06, by + cfH*0.6, bx, by + cfH);
  ctx.quadraticCurveTo(bx - cw*0.06, by + cfH*0.6, bx - cw*0.13, by - ch*0.04);
  ctx.fill();

  // ── LEFT THRUSTER POD ────────────────────────────────────────────────────
  var lpX = bx - cw * 0.52;
  var lpY = by - ch * 0.18;
  // Pod housing
  ctx.fillStyle = '#0c0c1e';
  ctx.beginPath();
  ctx.moveTo(lpX - cw*0.17, lpY - ch*0.30);
  ctx.lineTo(lpX + cw*0.06, lpY - ch*0.30);
  ctx.lineTo(lpX + cw*0.09, lpY + ch*0.14);
  ctx.lineTo(lpX - cw*0.14, lpY + ch*0.14);
  ctx.closePath();
  ctx.fill();
  // Neon trim on pod
  ctx.strokeStyle = '#00ddff';
  ctx.lineWidth   = Math.max(1, sc * 1.8);
  ctx.beginPath();
  ctx.moveTo(lpX - cw*0.17, lpY - ch*0.30);
  ctx.lineTo(lpX + cw*0.06, lpY - ch*0.30);
  ctx.lineTo(lpX + cw*0.09, lpY + ch*0.14);
  ctx.stroke();
  // Nozzle ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = Math.max(1.5, sc * 2.5);
  ctx.beginPath();
  ctx.ellipse(lpX - cw*0.04, lpY + ch*0.10, cw*0.07, ch*0.10, 0, 0, Math.PI*2);
  ctx.stroke();
  // Left pod flame
  var lfH = ch * 0.40 * flicker;
  var lfG = ctx.createLinearGradient(lpX, lpY + ch*0.10, lpX, lpY + ch*0.10 + lfH);
  lfG.addColorStop(0,   'rgba(220,240,255,0.95)');
  lfG.addColorStop(0.35,'rgba(0,160,255,0.65)');
  lfG.addColorStop(1,   'rgba(0,30,200,0)');
  ctx.fillStyle = lfG;
  ctx.beginPath();
  ctx.ellipse(lpX - cw*0.04, lpY + ch*0.10 + lfH*0.45, cw*0.055, lfH*0.55, 0, 0, Math.PI*2);
  ctx.fill();

  // ── RIGHT THRUSTER POD ───────────────────────────────────────────────────
  var rpX = bx + cw * 0.52;
  var rpY = by - ch * 0.18;
  ctx.fillStyle = '#0c0c1e';
  ctx.beginPath();
  ctx.moveTo(rpX + cw*0.17, rpY - ch*0.30);
  ctx.lineTo(rpX - cw*0.06, rpY - ch*0.30);
  ctx.lineTo(rpX - cw*0.09, rpY + ch*0.14);
  ctx.lineTo(rpX + cw*0.14, rpY + ch*0.14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#00ddff';
  ctx.lineWidth   = Math.max(1, sc * 1.8);
  ctx.beginPath();
  ctx.moveTo(rpX + cw*0.17, rpY - ch*0.30);
  ctx.lineTo(rpX - cw*0.06, rpY - ch*0.30);
  ctx.lineTo(rpX - cw*0.09, rpY + ch*0.14);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = Math.max(1.5, sc * 2.5);
  ctx.beginPath();
  ctx.ellipse(rpX + cw*0.04, rpY + ch*0.10, cw*0.07, ch*0.10, 0, 0, Math.PI*2);
  ctx.stroke();
  var rfG = ctx.createLinearGradient(rpX, rpY + ch*0.10, rpX, rpY + ch*0.10 + lfH);
  rfG.addColorStop(0,   'rgba(220,240,255,0.95)');
  rfG.addColorStop(0.35,'rgba(0,160,255,0.65)');
  rfG.addColorStop(1,   'rgba(0,30,200,0)');
  ctx.fillStyle = rfG;
  ctx.beginPath();
  ctx.ellipse(rpX + cw*0.04, rpY + ch*0.10 + lfH*0.45, cw*0.055, lfH*0.55, 0, 0, Math.PI*2);
  ctx.fill();

  // ── MAIN BODY (angular futuristic hexagon) ───────────────────────────────
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(bx - cw*0.36, by - ch*0.06);   // bottom-left
  ctx.lineTo(bx - cw*0.46, by - ch*0.52);   // left waist
  ctx.lineTo(bx - cw*0.38, by - ch*0.96);   // top-left
  ctx.lineTo(bx + cw*0.38, by - ch*0.96);   // top-right
  ctx.lineTo(bx + cw*0.46, by - ch*0.52);   // right waist
  ctx.lineTo(bx + cw*0.36, by - ch*0.06);   // bottom-right
  ctx.closePath();
  ctx.fill();

  // Body panel lines (dark segments for futuristic look)
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth   = Math.max(1, sc * 1.5);
  ctx.beginPath();
  ctx.moveTo(bx - cw*0.18, by - ch*0.06);
  ctx.lineTo(bx - cw*0.20, by - ch*0.96);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + cw*0.18, by - ch*0.06);
  ctx.lineTo(bx + cw*0.20, by - ch*0.96);
  ctx.stroke();

  // Neon edge trim (cyan)
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth   = Math.max(1, sc * 1.2);
  ctx.beginPath();
  ctx.moveTo(bx - cw*0.36, by - ch*0.06);
  ctx.lineTo(bx - cw*0.46, by - ch*0.52);
  ctx.lineTo(bx - cw*0.38, by - ch*0.96);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + cw*0.36, by - ch*0.06);
  ctx.lineTo(bx + cw*0.46, by - ch*0.52);
  ctx.lineTo(bx + cw*0.38, by - ch*0.96);
  ctx.stroke();

  // Horizontal accent stripe
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth   = Math.max(1, sc);
  ctx.beginPath();
  ctx.moveTo(bx - cw*0.44, by - ch*0.52);
  ctx.lineTo(bx + cw*0.44, by - ch*0.52);
  ctx.stroke();

  // ── REAR WING (wide, swept-back) ─────────────────────────────────────────
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(bx - cw*0.70, by - ch*0.88);
  ctx.lineTo(bx + cw*0.70, by - ch*0.88);
  ctx.lineTo(bx + cw*0.64, by - ch*1.04);
  ctx.lineTo(bx - cw*0.64, by - ch*1.04);
  ctx.closePath();
  ctx.fill();
  // Wing endplates
  ctx.fillStyle = col;
  ctx.fillRect(bx - cw*0.74, by - ch*1.10, cw*0.09, ch*0.24);
  ctx.fillRect(bx + cw*0.65, by - ch*1.10, cw*0.09, ch*0.24);
  // Wing neon strip (magenta)
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth   = Math.max(1.5, sc * 1.5);
  ctx.beginPath();
  ctx.moveTo(bx - cw*0.70, by - ch*0.96);
  ctx.lineTo(bx + cw*0.70, by - ch*0.96);
  ctx.stroke();

  // ── COCKPIT BUBBLE CANOPY ────────────────────────────────────────────────
  // Dark frame
  ctx.fillStyle = '#060612';
  ctx.beginPath();
  ctx.ellipse(bx, by - ch*0.68, cw*0.22, ch*0.30, 0, 0, Math.PI*2);
  ctx.fill();
  // Glowing transparent canopy glass
  var canG = ctx.createRadialGradient(bx - cw*0.05, by - ch*0.78, 0, bx, by - ch*0.68, cw*0.22);
  canG.addColorStop(0,   'rgba(0,220,255,0.50)');
  canG.addColorStop(0.55,'rgba(0,120,220,0.25)');
  canG.addColorStop(1,   'rgba(0,40,120,0.08)');
  ctx.fillStyle = canG;
  ctx.beginPath();
  ctx.ellipse(bx, by - ch*0.68, cw*0.22, ch*0.30, 0, 0, Math.PI*2);
  ctx.fill();
  // Canopy highlight glint
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(bx - cw*0.09, by - ch*0.80, cw*0.07, ch*0.08, -0.4, 0, Math.PI*2);
  ctx.fill();

  // ── DRIVER HELMET ────────────────────────────────────────────────────────
  // Helmet body (dark)
  ctx.fillStyle = '#111120';
  ctx.beginPath();
  ctx.ellipse(bx, by - ch*0.68, cw*0.13, ch*0.20, 0, 0, Math.PI*2);
  ctx.fill();
  // Player-colour stripe across helmet top
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(bx, by - ch*0.78, cw*0.11, ch*0.07, 0, 0, Math.PI*2);
  ctx.fill();
  // Visor (glowing cyan gradient)
  var vizG = ctx.createLinearGradient(bx - cw*0.09, by - ch*0.74, bx + cw*0.09, by - ch*0.62);
  vizG.addColorStop(0,   'rgba(0,230,255,0.95)');
  vizG.addColorStop(0.5, 'rgba(0,160,255,0.80)');
  vizG.addColorStop(1,   'rgba(0,80,200,0.60)');
  ctx.fillStyle = vizG;
  ctx.beginPath();
  ctx.ellipse(bx + cw*0.01, by - ch*0.68, cw*0.09, ch*0.13, 0.1, 0, Math.PI*2);
  ctx.fill();
  // Visor glint
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(bx - cw*0.04, by - ch*0.74, cw*0.03, ch*0.04, -0.4, 0, Math.PI*2);
  ctx.fill();

  // ── ROLL HOOP / FIN ──────────────────────────────────────────────────────
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.moveTo(bx - cw*0.04, by - ch*0.94);
  ctx.lineTo(bx + cw*0.04, by - ch*0.94);
  ctx.lineTo(bx + cw*0.04, by - ch*0.64);
  ctx.lineTo(bx - cw*0.04, by - ch*0.64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth   = Math.max(1, sc);
  ctx.strokeRect(bx - cw*0.04, by - ch*0.94, cw*0.08, ch*0.30);

  // ── CENTRAL NOZZLE RING (at base of car body) ────────────────────────────
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = Math.max(2, sc * 3);
  ctx.beginPath();
  ctx.ellipse(bx, by - ch*0.03, cw*0.14, ch*0.08, 0, 0, Math.PI*2);
  ctx.stroke();
  ctx.strokeStyle = '#00aaff';
  ctx.lineWidth   = Math.max(1.5, sc * 2);
  ctx.beginPath();
  ctx.ellipse(bx, by - ch*0.03, cw*0.10, ch*0.06, 0, 0, Math.PI*2);
  ctx.stroke();

  // ── BRAKE / CRASH LIGHTS ────────────────────────────────────────────────
  var flashOn = Math.floor(Date.now() / 90) % 2 === 0;
  var lightOn = !keys.up || (wallHitTimer > 0 && flashOn);
  var lx = bx - cw * 0.30, rx = bx + cw * 0.30, ly = by - ch * 0.11;
  // Always-visible dim lens (light off state)
  ctx.fillStyle = '#550000';
  ctx.beginPath(); ctx.ellipse(lx, ly, cw*0.055, ch*0.065, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(rx, ly, cw*0.055, ch*0.065, 0, 0, Math.PI*2); ctx.fill();
  if (lightOn) {
    // Glow halos
    ctx.save();
    ctx.globalAlpha = 0.45;
    var lglow = ctx.createRadialGradient(lx, ly, 0, lx, ly, cw * 0.13);
    lglow.addColorStop(0, '#ff2020'); lglow.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = lglow;
    ctx.beginPath(); ctx.ellipse(lx, ly, cw*0.13, ch*0.15, 0, 0, Math.PI*2); ctx.fill();
    var rglow = ctx.createRadialGradient(rx, ly, 0, rx, ly, cw * 0.13);
    rglow.addColorStop(0, '#ff2020'); rglow.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = rglow;
    ctx.beginPath(); ctx.ellipse(rx, ly, cw*0.13, ch*0.15, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Bright lit lens
    ctx.fillStyle = '#ff1010';
    ctx.beginPath(); ctx.ellipse(lx, ly, cw*0.055, ch*0.065, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(rx, ly, cw*0.055, ch*0.065, 0, 0, Math.PI*2); ctx.fill();
    // Bright centre spot
    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath(); ctx.ellipse(lx, ly, cw*0.022, ch*0.028, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(rx, ly, cw*0.022, ch*0.028, 0, 0, Math.PI*2); ctx.fill();
  }

  ctx.restore(); // end cornering tilt

  // ── GROUND SHADOW ────────────────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle   = '#000';
  ctx.beginPath();
  ctx.ellipse(bx, sy + 3, cw * 0.50, ch * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─────────────────────────────────────────────
// Speedometer
// ─────────────────────────────────────────────
function drawSpeedometer(speed) {
  var barMaxW=160, barH=12, barX=W-barMaxW-16, barY=H-48;
  var frac=Math.min(speed/MAX_SPEED,1), barW=Math.round(barMaxW*frac);
  var kmh=Math.round(speed*0.72);
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.62)'; ctx.fillRect(barX-4,barY-18,barMaxW+8,barH+22);
  ctx.fillStyle='#aaa'; ctx.font='10px Courier New'; ctx.textAlign='left';
  ctx.fillText('SPEED  '+kmh+' km/h',barX,barY-5);
  ctx.fillStyle='#333'; ctx.fillRect(barX,barY,barMaxW,barH);
  var rr=Math.round(255*frac), gg=Math.round(255*(1-frac*0.6));
  ctx.fillStyle='rgb('+rr+','+gg+',40)'; ctx.fillRect(barX,barY,barW,barH);
  ctx.restore();
}

// ─────────────────────────────────────────────
// Shared scene render helper
// ─────────────────────────────────────────────
function drawScene() {
  drawBackground();
  drawRoad();
  drawWalls();
  drawObstacles();
  drawPlayerCar3D();
}

// ─────────────────────────────────────────────
// Countdown overlay (3-2-1-GO!)
// ─────────────────────────────────────────────
function drawCountdown(elapsed) {
  var sec   = Math.floor(elapsed / 1000);   // 0, 1, 2 → number shown; 3 → GO!
  var frac  = (elapsed % 1000) / 1000;      // 0→1 within each second
  var label = sec < 3 ? String(3 - sec) : 'GO!';
  var scale = 1 + 0.4 * (1 - frac);        // pulses large at beat, shrinks into next
  var alpha = sec < 3 ? 1 : Math.max(0, 1 - frac * 3);

  ctx.save();
  ctx.globalAlpha  = alpha;
  ctx.font         = 'bold ' + Math.round(96 * scale) + 'px Courier New';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  // Drop-shadow
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(label, W / 2 + 4, H / 2 + 4);
  // Main text — red for numbers, bright green for GO!
  ctx.fillStyle = sec < 3 ? '#ff4444' : '#44ff88';
  ctx.fillText(label, W / 2, H / 2);
  ctx.restore();
}

// ─────────────────────────────────────────────
// Start screen
// ─────────────────────────────────────────────
function drawStartScreen() {
  updateCamera();
  drawScene();

  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.64)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#e94560'; ctx.font='bold 48px Courier New';
  ctx.fillText('RACING GAME',W/2,210);
  ctx.fillStyle='#00ffff'; ctx.font='bold 15px Courier New';
  ctx.fillText('NASCAR SUPERSPEEDWAY',W/2,248);
  ctx.fillStyle='#fff'; ctx.font='20px Courier New';
  ctx.fillText('Press SPACE to start',W/2,310);
  ctx.fillStyle='#aaa'; ctx.font='14px Courier New';
  ctx.fillText('Arrow keys / WASD to drive   |   P to pause',W/2,348);
  ctx.fillStyle='#ffee77'; ctx.font='13px Courier New';
  ctx.fillText('Hit ramp boosts for extra speed!',W/2,385);
  ctx.restore();
}

// ─────────────────────────────────────────────
// Pause screen
// ─────────────────────────────────────────────
function drawPauseScreen() {
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='bold 40px Courier New';
  ctx.fillText('PAUSED',W/2,290);
  ctx.font='18px Courier New'; ctx.fillStyle='#aaa';
  ctx.fillText('Press P to continue',W/2,335);
  ctx.restore();
}

// ─────────────────────────────────────────────
// Race-over screen
// ─────────────────────────────────────────────
function drawRaceOverScreen() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 48px Courier New';
  ctx.fillText('RACE COMPLETE', W / 2, 120);

  ctx.font = 'bold 14px Courier New';
  ctx.fillStyle = '#aaa';
  ctx.fillText(RACE_LAPS + '-LAP RESULTS', W / 2, 158);

  // Find best lap index
  var bestIdx = 0;
  for (var i = 1; i < lap.lapTimes.length; i++) {
    if (lap.lapTimes[i] < lap.lapTimes[bestIdx]) bestIdx = i;
  }
  for (var i = 0; i < lap.lapTimes.length; i++) {
    ctx.fillStyle = (i === bestIdx) ? '#ffd700' : '#ffffff';
    ctx.font = (i === bestIdx) ? 'bold 20px Courier New' : '18px Courier New';
    var label = (i === bestIdx) ? 'Lap ' + (i + 1) + ':  ' + formatTime(lap.lapTimes[i]) + '  ★ BEST' :
                                  'Lap ' + (i + 1) + ':  ' + formatTime(lap.lapTimes[i]);
    ctx.fillText(label, W / 2, 200 + i * 36);
  }

  ctx.font = '18px Courier New';
  ctx.fillStyle = '#00ffff';
  ctx.fillText('SPACE  — keep going', W / 2, 390);
  ctx.fillStyle = '#ff8844';
  ctx.fillText('R  — restart race', W / 2, 420);
  ctx.restore();
}

// ─────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────
var lastTime = null;

function loop(timestamp) {
  var dt = lastTime === null ? 0 : Math.min((timestamp-lastTime)/1000, 0.05);
  lastTime = timestamp;

  if (gameState === STATE_PLAYING) {
    var prevX=player.x, prevY=player.y;
    player.update(dt, keys, track);
    if (track.getCell(player.x, player.y) === 0) {
      player.x=prevX; player.y=prevY; player.speed*=-0.2;
      wallHitTimer = 700;
      if (wallBeepCooldown <= 0) { SoundSystem.crash(); wallBeepCooldown = 900; }
    }
    if (wallHitTimer    > 0) wallHitTimer    -= dt * 1000;
    if (wallBeepCooldown > 0) wallBeepCooldown -= dt * 1000;
    lap.update(player, timestamp);
    if (!raceOverDismissed && lap.lapTimes.length >= RACE_LAPS) {
      gameState = STATE_RACE_OVER;
    }
    updateCamera();

    var targetTilt = keys.left ? -0.18 : keys.right ? 0.18 : 0;
    carTilt += (targetTilt - carTilt) * Math.min(1, dt * 7);

    var isTurning = keys.left || keys.right;
    for (var oi=0;oi<OBSTACLES.length;oi++) {
      var obs=OBSTACLES[oi], odx=player.x-obs.x, ody=player.y-obs.y;
      if(Math.sqrt(odx*odx+ody*ody)<obs.r+14&&player.rampCooldown<=0){
        player.speed=Math.min(player.speed*1.5,MAX_SPEED*1.3);
        player.rampCooldown=1.0; SoundSystem.boost();
      }
    }
    SoundSystem.update(player.speed, isTurning);

    drawScene();
    lap.drawHUD(ctx); lap.drawLeaderboard(ctx); lap.drawWrongWay(ctx);
    var effSpd=player.offTrack?Math.abs(player.speed)*OFFTRACK_MULT:Math.abs(player.speed);
    drawSpeedometer(effSpd);

  } else if (gameState === STATE_COUNTDOWN) {
    updateCamera();
    drawScene();
    lap.drawHUD(ctx);
    var elapsed = timestamp - countdownStart;
    if (elapsed >= 4000) {
      gameState = STATE_PLAYING;   // GO! has fully faded — begin race
    } else {
      drawCountdown(elapsed);
    }

  } else if (gameState === STATE_START) {
    drawStartScreen();

  } else if (gameState === STATE_PAUSED) {
    updateCamera();
    drawScene();
    lap.drawHUD(ctx); lap.drawLeaderboard(ctx);
    var pauseSpd=player.offTrack?Math.abs(player.speed)*OFFTRACK_MULT:Math.abs(player.speed);
    drawSpeedometer(pauseSpd);
    drawPauseScreen();

  } else if (gameState === STATE_RACE_OVER) {
    updateCamera();
    drawScene();
    lap.drawHUD(ctx); lap.drawLeaderboard(ctx);
    var roSpd=player.offTrack?Math.abs(player.speed)*OFFTRACK_MULT:Math.abs(player.speed);
    drawSpeedometer(roSpd);
    drawRaceOverScreen();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
