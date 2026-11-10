// Turns noisy Bluetooth RSSI readings into a smoothed level, a warmer/colder trend
// and a rough distance band. Pure TypeScript so it can be unit-tested off-device.

export type Trend = 'warmer' | 'colder' | 'steady';
export type Band = 'very close' | 'close' | 'nearby' | 'far';

export type Sample = { t: number; raw: number; smooth: number };

export type TrackerOptions = {
  /** How much the true signal is expected to drift per second (dB^2/s). Scaled by the time
   * between readings, so smoothing behaves the same whether a phone reports 2 or 30 times a second. */
  processNoisePerSecond: number;
  /** How noisy a single reading is (dB^2); crowds make this large. */
  measurementNoise: number;
  /** Window used for the trend slope. */
  trendWindowMs: number;
  /** Slope (dB per second) below which the trend counts as steady. */
  trendDeadband: number;
  /** How long samples are kept for the history chart and log. */
  historyMs: number;
};

export const DEFAULT_OPTIONS: TrackerOptions = {
  processNoisePerSecond: 5,
  measurementNoise: 16,
  trendWindowMs: 4000,
  trendDeadband: 0.4,
  historyMs: 30000,
};

/** One-dimensional Kalman filter tracking a single peer's signal level. */
export class SignalTracker {
  private estimate: number | null = null;
  private variance = 0;
  private lastT = 0;
  readonly samples: Sample[] = [];

  constructor(private readonly options: TrackerOptions = DEFAULT_OPTIONS) {}

  add(rssi: number, t: number): number {
    if (this.estimate === null) {
      this.estimate = rssi;
      this.variance = this.options.measurementNoise;
    } else {
      const dt = Math.max(0, t - this.lastT) / 1000;
      this.variance += this.options.processNoisePerSecond * dt;
      const gain = this.variance / (this.variance + this.options.measurementNoise);
      this.estimate += gain * (rssi - this.estimate);
      this.variance *= 1 - gain;
    }
    this.lastT = t;
    this.samples.push({ t, raw: rssi, smooth: this.estimate });
    const cutoff = t - this.options.historyMs;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) this.samples.shift();
    return this.estimate;
  }

  get level(): number | null {
    return this.estimate;
  }

  get lastSeen(): number | null {
    return this.samples.length > 0 ? this.samples[this.samples.length - 1].t : null;
  }

  /** Least-squares slope of the smoothed level over the trend window, in dB per second. */
  slope(now: number): number | null {
    const window = this.samples.filter((s) => s.t >= now - this.options.trendWindowMs);
    if (window.length < 3) return null;
    const n = window.length;
    const meanT = window.reduce((sum, s) => sum + s.t, 0) / n;
    const meanY = window.reduce((sum, s) => sum + s.smooth, 0) / n;
    let num = 0;
    let den = 0;
    for (const s of window) {
      num += (s.t - meanT) * (s.smooth - meanY);
      den += (s.t - meanT) ** 2;
    }
    return den === 0 ? 0 : (num / den) * 1000;
  }

  trend(now: number): Trend {
    const slope = this.slope(now);
    if (slope === null || Math.abs(slope) < this.options.trendDeadband) return 'steady';
    return slope > 0 ? 'warmer' : 'colder';
  }
}

// ---- Distance and closeness levels ----
//
// Phones differ by 20-30 dB in how strong they transmit and how well they receive, so a fixed
// "dBm at 1 m" is useless. Instead each pair is calibrated once: hold the phones together and
// record the signal. Distance is then estimated relative to that reading.

export type Calibration = { rssiTogether: number };

/** Used until the phones are calibrated; typical of two phones touching at high power. */
export const DEFAULT_CALIBRATION: Calibration = { rssiTogether: -45 };

/** How far apart "together" is, in metres (phones held side by side). */
const TOGETHER_METRES = 0.05;
// Indoors and in crowds the signal falls off a bit faster than in free space (2.0).
const PATH_LOSS_EXPONENT = 2.2;

/** Rough distance in metres from a smoothed signal level. */
export function metresFor(rssi: number, cal: Calibration = DEFAULT_CALIBRATION): number {
  const m = TOGETHER_METRES * 10 ** ((cal.rssiTogether - rssi) / (10 * PATH_LOSS_EXPONENT));
  return Math.max(TOGETHER_METRES, m);
}

/** Inverse of metresFor: the signal level expected at a given distance. */
export function rssiAt(metres: number, cal: Calibration = DEFAULT_CALIBRATION): number {
  return cal.rssiTogether - 10 * PATH_LOSS_EXPONENT * Math.log10(metres / TOGETHER_METRES);
}

/**
 * Closeness levels 0 (far) to 9 (right here). The edges are wide far away, so the buzzing speeds
 * up quickly as soon as you start closing in, and narrow in the last few metres, so the final
 * approach changes in small steps.
 */
export const LEVEL_EDGES_METRES = [20, 12, 8, 5, 3.5, 2.5, 1.8, 1.2, 0.6] as const;
export const MAX_LEVEL = LEVEL_EDGES_METRES.length; // 9

export function levelForMetres(metres: number): number {
  return LEVEL_EDGES_METRES.filter((edge) => metres < edge).length;
}

/** dB the signal must move past an edge before the level changes, so it doesn't flicker. */
const LEVEL_HYSTERESIS_DB = 2;

/** Closeness level for a smoothed signal level, sticking to `previous` near an edge. */
export function levelFor(rssi: number, cal: Calibration = DEFAULT_CALIBRATION, previous: number | null = null): number {
  const level = levelForMetres(metresFor(rssi, cal));
  if (previous === null || level === previous) return level;
  // Only move if the signal is clearly past the edge.
  const nudged = level > previous ? rssi - LEVEL_HYSTERESIS_DB : rssi + LEVEL_HYSTERESIS_DB;
  return levelForMetres(metresFor(nudged, cal)) === previous ? previous : level;
}

/** Human-readable distance range for a level, e.g. "2.5-3.5 m". */
export function levelRange(level: number): string {
  if (level <= 0) return `over ${LEVEL_EDGES_METRES[0]} m`;
  if (level >= MAX_LEVEL) return `under ${LEVEL_EDGES_METRES[MAX_LEVEL - 1]} m`;
  return `${LEVEL_EDGES_METRES[level]}-${LEVEL_EDGES_METRES[level - 1]} m`;
}

export function band(level: number): Band {
  if (level >= 8) return 'very close';
  if (level >= 5) return 'close';
  if (level >= 2) return 'nearby';
  return 'far';
}

/** Short distance text, with a decimal under 3 m. */
export function formatMetres(metres: number): string {
  return metres < 3 ? `${metres.toFixed(1)} m` : `${Math.round(metres)} m`;
}

/**
 * Calibration from the last few seconds of readings taken with the phones held together.
 * Uses the median raw reading, so one odd packet doesn't skew it. Null if too few readings.
 */
export function calibrateFrom(samples: readonly Sample[], now: number, windowMs = 3000): Calibration | null {
  const raws = samples
    .filter((s) => s.t >= now - windowMs)
    .map((s) => s.raw)
    .sort((a, b) => a - b);
  if (raws.length < 5) return null;
  return { rssiTogether: raws[Math.floor(raws.length / 2)] };
}
