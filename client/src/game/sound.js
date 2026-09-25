export const soundState = { enabled: true };

let ac = null;

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq, dur = 0.15, type = 'sine', gain = 0.04, when = 0) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur = 0.3, gain = 0.02) {
  const c = ctx();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.destination);
  src.start();
}

export function playChatOpen() {
  if (!soundState.enabled) return;
  tone(620, 0.06, 'triangle', 0.015);
}

export function playPing() {
  if (!soundState.enabled) return;
  tone(880, 0.12, 'sine', 0.035);
  tone(1320, 0.1, 'sine', 0.02, 0.08);
}

export function playOwn() {
  if (!soundState.enabled) return;
  tone(740, 0.09, 'sine', 0.03);
  tone(1100, 0.09, 'sine', 0.018, 0.07);
}

export function playSystem() {
  if (!soundState.enabled) return;
  tone(523, 0.18, 'triangle', 0.025);
  tone(659, 0.18, 'triangle', 0.025, 0.1);
  tone(784, 0.24, 'triangle', 0.03, 0.2);
}

export function playFootstep() {
  if (!soundState.enabled) return;
  noise(0.03, 0.012);
}

export function playWhisper(intensity = 1) {
  if (!soundState.enabled) return;
  tone(180 + Math.random() * 120, 0.25, 'sine', 0.02 * intensity);
  tone(90 + Math.random() * 60, 0.3, 'sine', 0.018 * intensity, 0.05);
}

export function playBB() {
  if (!soundState.enabled) return;
  tone(196, 0.28, 'sawtooth', 0.03);
  tone(262, 0.22, 'sawtooth', 0.028, 0.12);
  tone(392, 0.3, 'sawtooth', 0.032, 0.24);
  tone(523, 0.4, 'sawtooth', 0.036, 0.4);
}

export function playCorrect() {
  if (!soundState.enabled) return;
  tone(660, 0.1, 'triangle', 0.035);
  tone(880, 0.1, 'triangle', 0.035, 0.09);
  tone(1108, 0.18, 'triangle', 0.035, 0.18);
}

export function playWrong() {
  if (!soundState.enabled) return;
  tone(240, 0.16, 'square', 0.03);
  tone(180, 0.22, 'square', 0.028, 0.12);
}

export function playCoin() {
  if (!soundState.enabled) return;
  tone(988, 0.09, 'triangle', 0.028);
  tone(1319, 0.16, 'triangle', 0.026, 0.07);
}