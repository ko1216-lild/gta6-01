// All sound is synthesised with WebAudio: no audio files, nothing to load. Short blips for
// shots, punches and pickups; two continuous voices, the player's engine (pitch follows
// speed) and a police siren (two-tone, only while a police car is near). M mutes everything.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  /** The context may only start after a user gesture; main calls this on start/confirm. */
  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }

  function tone(freq, dur, type, gain, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(amp).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, gain, freq) {
    if (!ctx || muted) return;
    const size = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.connect(filter).connect(amp).connect(master);
    src.start();
  }

  /** Engine voice: call every frame with the speed ratio (0..1), or null to switch it off. */
  function engine(ratio) {
    if (!ctx) return;
    if (ratio === null) {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      return;
    }
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0;
      engineOsc.connect(filter).connect(engineGain).connect(master);
      engineOsc.start();
    }
    engineOsc.frequency.setTargetAtTime(52 + ratio * 118, ctx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(muted ? 0 : 0.05 + ratio * 0.05, ctx.currentTime, 0.05);
  }

  /** Siren voice: call every frame with true while police are close; it warbles on its own. */
  function siren(active, dt) {
    if (!ctx) return;
    if (!active) {
      if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      return;
    }
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
    }
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 0.34;
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.setValueAtTime(sirenHigh ? 940 : 690, ctx.currentTime);
    }
    sirenGain.gain.setTargetAtTime(muted ? 0 : 0.028, ctx.currentTime, 0.05);
  }

  return {
    unlock,
    engine,
    siren,
    shot() { noise(0.14, 0.5, 1600); tone(150, 0.1, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.35, 500); tone(90, 0.09, 'sine', 0.3, 45); },
    pickup() { tone(880, 0.09, 'sine', 0.22); setTimeout(() => tone(1320, 0.12, 'sine', 0.22), 55); },
    cash() { tone(990, 0.08, 'triangle', 0.25); setTimeout(() => tone(1480, 0.14, 'triangle', 0.25), 60); },
    mission() { tone(523, 0.12, 'triangle', 0.25); setTimeout(() => tone(784, 0.2, 'triangle', 0.25), 110); },
    enter() { tone(220, 0.08, 'sine', 0.2, 180); },
    crash() { noise(0.22, 0.4, 700); },
    alarm() { tone(392, 0.16, 'square', 0.2); setTimeout(() => tone(311, 0.24, 'square', 0.2), 150); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
}
