/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { band, pulseIntervalMs, roughMetres, SignalTracker } from '../src/signal';

// Deterministic noise so the test is repeatable.
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return (s / 2 ** 31 - 0.5) * 2;
  };
}

test('smoothing cuts the noise of individual readings', () => {
  const tracker = new SignalTracker();
  const rand = noise(1);
  let rawError = 0;
  let smoothError = 0;
  for (let i = 0; i < 200; i++) {
    const raw = -70 + rand() * 8;
    const smooth = tracker.add(raw, i * 100);
    if (i > 20) {
      rawError += Math.abs(raw + 70);
      smoothError += Math.abs(smooth + 70);
    }
  }
  assert.ok(smoothError < rawError / 3, `smooth ${smoothError} vs raw ${rawError}`);
});

test('walking towards the beacon reads as warmer, away as colder', () => {
  const rand = noise(2);
  const toward = new SignalTracker();
  const away = new SignalTracker();
  for (let i = 0; i <= 80; i++) {
    const t = i * 100; // 8 seconds at 10 readings per second
    toward.add(-90 + i * 0.25 + rand() * 6, t);
    away.add(-60 - i * 0.25 + rand() * 6, t);
  }
  assert.equal(toward.trend(8000), 'warmer');
  assert.equal(away.trend(8000), 'colder');
});

test('standing still reads as steady', () => {
  const rand = noise(3);
  const tracker = new SignalTracker();
  for (let i = 0; i <= 80; i++) tracker.add(-75 + rand() * 4, i * 100);
  assert.equal(tracker.trend(8000), 'steady');
});

test('smoothing catches up in similar time at slow and fast report rates', () => {
  // A 10 dB step: the smoothed level should catch up in similar time at 5 Hz and 25 Hz.
  const catchUpMs = (hz: number) => {
    const tracker = new SignalTracker();
    const step = 1000 / hz;
    for (let t = 0; t < 5000; t += step) tracker.add(-80, t);
    for (let t = 5000; t < 20000; t += step) {
      if (tracker.add(-70, t) > -72) return t - 5000;
    }
    return Infinity;
  };
  const slow = catchUpMs(5);
  const fast = catchUpMs(25);
  assert.ok(Math.abs(slow - fast) < 1000, `5 Hz ${slow} ms vs 25 Hz ${fast} ms`);
});

test('old samples are dropped after 30 seconds', () => {
  const tracker = new SignalTracker();
  for (let i = 0; i <= 400; i++) tracker.add(-70, i * 100);
  assert.ok(tracker.samples[0].t >= 40000 - 30000);
});

test('bands, rough distance and haptic pace', () => {
  assert.equal(band(-55), 'very close');
  assert.equal(band(-70), 'close');
  assert.equal(band(-80), 'nearby');
  assert.equal(band(-95), 'far');
  assert.ok(Math.abs(roughMetres(-59) - 1) < 1e-9);
  assert.ok(roughMetres(-84) > roughMetres(-70));
  assert.equal(pulseIntervalMs(-95), 2000);
  assert.equal(pulseIntervalMs(-50), 300);
});
