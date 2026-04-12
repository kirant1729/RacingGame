// sound.js — Web Audio API engine, tyre screech, and boost sounds

var SoundSystem = (function () {

  var actx      = null;
  var eng1      = null, eng2 = null, engGain = null;
  var screezeFilter = null, screezeGain = null;
  var started   = false;

  // ── Initialise audio graph on first user gesture ──────────────────────────
  function init() {
    if (started) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();

    // ── Engine: two slightly-detuned sawtooth oscillators ──────────────────
    engGain = actx.createGain();
    engGain.gain.value = 0;
    engGain.connect(actx.destination);

    eng1 = actx.createOscillator();
    eng1.type = 'sawtooth';
    eng1.frequency.value = 55;
    eng1.connect(engGain);
    eng1.start();

    eng2 = actx.createOscillator();
    eng2.type = 'sawtooth';
    eng2.frequency.value = 58;   // slight detune for warmth
    eng2.connect(engGain);
    eng2.start();

    // ── Tyre screech: looped white noise through a bandpass filter ──────────
    var rate       = actx.sampleRate;
    var noiseBuf   = actx.createBuffer(1, rate, rate);    // 1-second loop
    var noiseData  = noiseBuf.getChannelData(0);
    for (var i = 0; i < rate; i++) noiseData[i] = Math.random() * 2 - 1;

    var noiseSrc = actx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop   = true;

    screezeFilter = actx.createBiquadFilter();
    screezeFilter.type            = 'bandpass';
    screezeFilter.frequency.value = 900;
    screezeFilter.Q.value         = 1.2;

    screezeGain = actx.createGain();
    screezeGain.gain.value = 0;

    noiseSrc.connect(screezeFilter);
    screezeFilter.connect(screezeGain);
    screezeGain.connect(actx.destination);
    noiseSrc.start();

    started = true;
  }

  // ── Update every frame ────────────────────────────────────────────────────
  // speed      : current car speed (px/s)
  // isTurning  : true when left/right is held
  function update(speed, isTurning) {
    if (!actx) return;
    var t     = actx.currentTime;
    var abSpd = Math.abs(speed);
    var frac  = Math.min(abSpd / MAX_SPEED, 1);

    // Engine pitch: 55 Hz (idle) → 230 Hz (flat-out)
    var f1 = 55 + frac * 175;
    eng1.frequency.setTargetAtTime(f1,        t, 0.08);
    eng2.frequency.setTargetAtTime(f1 * 1.06, t, 0.08);

    // Engine volume: faint idle hum, grows with speed
    var vol = 0.04 + frac * 0.11;
    engGain.gain.setTargetAtTime(vol, t, 0.06);

    // Tyre screech: audible only when fast and turning
    var screezeVol = (frac > 0.35 && isTurning) ? 0.18 * ((frac - 0.35) / 0.65) : 0;
    screezeGain.gain.setTargetAtTime(screezeVol, t, 0.12);
  }

  // ── One-shot boost chirp (call when ramp is hit) ──────────────────────────
  function boost() {
    if (!actx) return;
    var osc  = actx.createOscillator();
    var gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.type = 'sine';
    var t = actx.currentTime;
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(680, t + 0.25);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // ── Wall-crash beep (short descending klaxon) ────────────────────────────
  function crash() {
    if (!actx) return;
    var osc  = actx.createOscillator();
    var gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.type = 'square';
    var t = actx.currentTime;
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.18);
    gain.gain.setValueAtTime(0.30, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.22);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  return { init: init, update: update, boost: boost, crash: crash };
}());
