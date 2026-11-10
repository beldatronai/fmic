// The shared vibration pattern. Both phones look up the same closeness level here and fire
// each pulse on the same wall-clock boundary, so they buzz together (phone clocks are set from
// the network and usually agree to within a few tens of milliseconds).

export type PulseStrength = 'light' | 'medium' | 'heavy';
export type Pulse = { intervalMs: number; strength: PulseStrength; double: boolean };

// Index = closeness level 0-9. Far levels speed up in big jumps; the last few metres in small ones.
export const PULSES: readonly Pulse[] = [
  { intervalMs: 2000, strength: 'light', double: false }, // over 20 m
  { intervalMs: 1400, strength: 'light', double: false }, // 12-20 m
  { intervalMs: 1000, strength: 'medium', double: false }, // 8-12 m
  { intervalMs: 800, strength: 'medium', double: false }, // 5-8 m
  { intervalMs: 650, strength: 'medium', double: false }, // 3.5-5 m
  { intervalMs: 560, strength: 'heavy', double: false }, // 2.5-3.5 m
  { intervalMs: 500, strength: 'heavy', double: false }, // 1.8-2.5 m
  { intervalMs: 450, strength: 'heavy', double: false }, // 1.2-1.8 m
  { intervalMs: 400, strength: 'heavy', double: true }, // 0.6-1.2 m
  { intervalMs: 350, strength: 'heavy', double: true }, // under 0.6 m
];

/** Gap inside a double pulse. */
export const DOUBLE_GAP_MS = 110;

/**
 * Next wall-clock time (ms) to pulse at for this interval: the next whole multiple of it.
 * Timers can fire a few ms early, so anything within `slackMs` of a boundary counts as having
 * reached it; this stops a pulse from firing twice.
 */
export function nextPulseAt(now: number, intervalMs: number, slackMs = 30): number {
  return (Math.floor((now + slackMs) / intervalMs) + 1) * intervalMs;
}
