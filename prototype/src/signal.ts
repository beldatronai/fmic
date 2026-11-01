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

// Rough path-loss model. Both values need calibrating per phone model in the field.
const RSSI_AT_ONE_METRE = -59;
const PATH_LOSS_EXPONENT = 2.5;

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

export function band(rssi: number): Band {
  if (rssi >= -60) return 'very close';
  if (rssi >= -72) return 'close';
  if (rssi >= -85) return 'nearby';
  return 'far';
}

/** Very rough distance in metres; only good for showing an order of magnitude. */
export function roughMetres(rssi: number): number {
  return 10 ** ((RSSI_AT_ONE_METRE - rssi) / (10 * PATH_LOSS_EXPONENT));
}

/** Haptic pulse interval: slow when far, fast when close. */
export function pulseIntervalMs(rssi: number): number {
  const clamped = Math.min(-50, Math.max(-95, rssi));
  const closeness = (clamped + 95) / 45; // 0 far, 1 close
  return Math.round(2000 - closeness * 1700);
}
