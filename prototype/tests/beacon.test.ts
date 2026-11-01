/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colourFor, maxFlashesPerSecond, randomId, RHYTHMS, rhythmFor } from '../src/beacon';

test('every rhythm stays under 3 flashes per second', () => {
  for (const rhythm of RHYTHMS) {
    assert.ok(maxFlashesPerSecond(rhythm) < 3, rhythm.name);
  }
});

test('both phones derive the same colour and rhythm from an id', () => {
  assert.deepEqual(colourFor('AB12'), colourFor('AB12'));
  assert.deepEqual(rhythmFor('AB12'), rhythmFor('AB12'));
});

test('ids are 4 unambiguous characters', () => {
  for (let i = 0; i < 100; i++) assert.match(randomId(), /^[A-HJ-NP-Z2-9]{4}$/);
});

test('ids spread across colours and rhythms', () => {
  const combos = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const id = randomId();
    combos.add(`${colourFor(id).name}/${rhythmFor(id).name}`);
  }
  assert.ok(combos.size >= 12, `only ${combos.size} combinations`);
});
