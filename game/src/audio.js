// Ember Pact — tiny WebAudio synth. No audio files, no network: every sound is
// an oscillator + gain envelope, created lazily on the first user gesture so
// browsers never block it.

let ctx = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  draw() { tone(520, 0.08, 'triangle', 0.07, 760); },
  play() { tone(392, 0.12, 'triangle', 0.12, 523); tone(523, 0.1, 'sine', 0.08, 659, 0.05); },
  hit() { tone(160, 0.18, 'sawtooth', 0.14, 60); },
  block() { tone(220, 0.1, 'square', 0.07, 180); },
  heal() { tone(523, 0.16, 'sine', 0.1, 784); tone(784, 0.2, 'sine', 0.07, 1046, 0.08); },
  turn() { tone(330, 0.09, 'triangle', 0.08, 440); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.11, null, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, null, i * 0.14)); },
  click() { tone(660, 0.05, 'square', 0.05); },
};
