// What each phone broadcasts over Bluetooth, as a 10-character ASCII string:
//   role (L or S) + group code (4) + phone id (4) + closeness level (0-9, or "-" for none)
// e.g. "SK7PQAB125": a seeker in group K7PQ, phone AB12, at closeness level 5.
// The seeker broadcasts the level it measures so the Lighthouse can buzz in the same pattern.
// Android carries this in service data (13 bytes free), iOS in the local name ("LH" + payload).

export type Role = 'L' | 'S';

export type Payload = { role: Role; group: string; id: string; level: number | null };

const CODE = '[A-HJ-NP-Z2-9]{4}';
const PATTERN = new RegExp(`^([LS])(${CODE})(${CODE})([0-9-])$`);

export function encodePayload(p: Payload): string {
  return p.role + p.group + p.id + (p.level === null ? '-' : String(p.level));
}

export function decodePayload(text: string): Payload | null {
  const m = PATTERN.exec(text);
  if (!m) return null;
  return {
    role: m[1] as Role,
    group: m[2],
    id: m[3],
    level: m[4] === '-' ? null : Number(m[4]),
  };
}
