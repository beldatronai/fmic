/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  band,
  calibrateFrom,
  levelFor,
  levelForMetres,
  levelRange,
  LEVEL_EDGES_METRES,
  MAX_LEVEL,
  metresFor,
  rssiAt,
  SignalTracker,
} from '../src/signal';
import { nextPulseAt, PULSES } from '../src/pulse';

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

test('distance is measured from the calibrated "together" reading', () => {
  const cal = { rssiTogether: -78 }; // the reading seen in the field with phones 4 cm apart
  assert.ok(metresFor(-78, cal) < 0.1, 'together reads as together, not 6 m');
  assert.ok(Math.abs(metresFor(rssiAt(5, cal), cal) - 5) < 1e-9);
  assert.ok(metresFor(-90, cal) > metresFor(-85, cal));
  assert.equal(levelFor(-78, cal), MAX_LEVEL);
});

test('levels: big steps far away, small steps in the last metres', () => {
  assert.equal(levelForMetres(30), 0);
  assert.equal(levelForMetres(10), 2);
  assert.equal(levelForMetres(3), 5);
  assert.equal(levelForMetres(0.3), 9);
  // Edge spacing shrinks towards the end.
  for (let i = 1; i < LEVEL_EDGES_METRES.length; i++) {
    assert.ok(LEVEL_EDGES_METRES[i] < LEVEL_EDGES_METRES[i - 1]);
  }
  assert.equal(levelRange(0), 'over 20 m');
  assert.equal(levelRange(5), '2.5-3.5 m');
  assert.equal(levelRange(9), 'under 0.6 m');
  assert.equal(band(9), 'very close');
  assert.equal(band(0), 'far');
});

test('level sticks near an edge (hysteresis)', () => {
  const cal = { rssiTogether: -45 };
  const edge = rssiAt(5, cal); // between level 3 and 4
  assert.equal(levelFor(edge + 0.5), 4);
  assert.equal(levelFor(edge + 0.5, cal, 3), 3, 'just past the edge keeps the old level');
  assert.equal(levelFor(edge + 3, cal, 3), 4, 'clearly past the edge moves');
  assert.equal(levelFor(edge - 0.5, cal, 4), 4);
  assert.equal(levelFor(edge - 3, cal, 4), 3);
});

test('buzzing speeds up early and changes gently at the end', () => {
  assert.equal(PULSES.length, MAX_LEVEL + 1);
  for (let i = 1; i < PULSES.length; i++) assert.ok(PULSES[i].intervalMs < PULSES[i - 1].intervalMs);
  const firstHalf = PULSES[0].intervalMs - PULSES[4].intervalMs;
  const lastHalf = PULSES[5].intervalMs - PULSES[9].intervalMs;
  assert.ok(firstHalf > 3 * lastHalf);
});

test('both phones pick the same pulse times from the clock', () => {
  assert.equal(nextPulseAt(10_000, 500), 10_500);
  assert.equal(nextPulseAt(10_480, 500), 11_000, 'a timer firing early does not pulse twice');
  assert.equal(nextPulseAt(10_123, 500), 10_500);
  // Two phones whose clocks read slightly differently still agree on the next pulse.
  assert.equal(nextPulseAt(20_100, 800), nextPulseAt(20_160, 800));
});

test('calibration takes the median of recent readings', () => {
  const samples = [-80, -50, -79, -78, -77, -78].map((raw, i) => ({ t: 1000 + i * 100, raw, smooth: raw }));
  assert.deepEqual(calibrateFrom(samples, 1600), { rssiTogether: -78 });
  assert.equal(calibrateFrom(samples.slice(0, 3), 1600), null);
  assert.equal(calibrateFrom(samples, 60_000), null, 'old readings are ignored');
});
