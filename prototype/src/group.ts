// A group is a 4-character code shared between the phones that belong together.
// Phones only follow other phones with the same code, and the code sets the colour and rhythm.
import { randomId } from './beacon';

export const LINK_SCHEME = 'lighthouseproto';

export function newGroupCode(random: () => number = Math.random): string {
  return randomId(random);
}

export function joinLink(code: string): string {
  return `${LINK_SCHEME}://join/${code}`;
}

export function shareMessage(code: string): string {
  return `Join my Lighthouse group: ${code}\nOpen ${joinLink(code)} or type the code in the app.`;
}

/** Reads a group code from typed text or a join link. Accepts lower case and spaces. */
export function parseGroupCode(input: string): string | null {
  const fromLink = /join\/([A-Za-z0-9]{4})/.exec(input);
  const raw = (fromLink ? fromLink[1] : input).replace(/[\s-]/g, '').toUpperCase();
  return /^[A-HJ-NP-Z2-9]{4}$/.test(raw) ? raw : null;
}
