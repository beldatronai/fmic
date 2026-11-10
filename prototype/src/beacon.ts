// Ids, colours and blink rhythms. Both phones derive the same colour and rhythm from the
// group code, so a seeker knows what to look for with no network.

export type Step = { on: boolean; ms: number };
export type Rhythm = { name: string; steps: Step[] };

export const COLOURS = [
  { name: 'blue', hex: '#1E6BFF' },
  { name: 'green', hex: '#00C853' },
  { name: 'yellow', hex: '#FFD600' },
  { name: 'magenta', hex: '#E040FB' },
  { name: 'cyan', hex: '#00E5FF' },
  { name: 'orange', hex: '#FF9100' },
] as const;
// White and red are left out on purpose: stage lights and other phones flood them.

export type Colour = (typeof COLOURS)[number];

// Every rhythm stays under 3 flashes in any one second (photosensitivity guideline).
export const RHYTHMS: Rhythm[] = [
  {
    name: 'two short, one long',
    steps: [
      { on: true, ms: 250 },
      { on: false, ms: 350 },
      { on: true, ms: 250 },
      { on: false, ms: 350 },
      { on: true, ms: 800 },
      { on: false, ms: 900 },
    ],
  },
  {
    name: 'slow pulse',
    steps: [
      { on: true, ms: 900 },
      { on: false, ms: 900 },
    ],
  },
  {
    name: 'three short',
    steps: [
      { on: true, ms: 250 },
      { on: false, ms: 350 },
      { on: true, ms: 250 },
      { on: false, ms: 350 },
      { on: true, ms: 250 },
      { on: false, ms: 1200 },
    ],
  },
];

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomId(random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 4; i++) id += ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)];
  return id;
}

function hash(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function colourFor(id: string): Colour {
  return COLOURS[hash(id) % COLOURS.length];
}

export function rhythmFor(id: string): Rhythm {
  return RHYTHMS[Math.floor(hash(id) / COLOURS.length) % RHYTHMS.length];
}

export function cycleMs(rhythm: Rhythm): number {
  return rhythm.steps.reduce((sum, s) => sum + s.ms, 0);
}

/** Largest number of flash starts in any sliding one-second window, over two cycles. */
export function maxFlashesPerSecond(rhythm: Rhythm): number {
  const starts: number[] = [];
  let t = 0;
  for (let cycle = 0; cycle < 2; cycle++) {
    for (const step of rhythm.steps) {
      if (step.on) starts.push(t);
      t += step.ms;
    }
  }
  let max = 0;
  for (const start of starts) {
    const count = starts.filter((s) => s >= start && s < start + 1000).length;
    max = Math.max(max, count);
  }
  return max;
}
