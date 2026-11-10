/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinLink, newGroupCode, parseGroupCode } from '../src/group';
import { decodePayload, encodePayload } from '../src/protocol';

test('payload round-trips and fits the Android scan response', () => {
  const p = { role: 'S' as const, group: 'K7PQ', id: 'AB23', level: 5 };
  const text = encodePayload(p);
  assert.equal(text, 'SK7PQAB235');
  assert.ok(text.length <= 13);
  assert.deepEqual(decodePayload(text), p);
  assert.deepEqual(decodePayload('LK7PQAB23-'), { role: 'L', group: 'K7PQ', id: 'AB23', level: null });
});

test('old or foreign payloads are rejected', () => {
  assert.equal(decodePayload('LAB12'), null); // previous app version
  assert.equal(decodePayload('XK7PQAB235'), null);
  assert.equal(decodePayload(''), null);
});

test('group codes come from links or typed text', () => {
  const code = newGroupCode();
  assert.equal(parseGroupCode(joinLink(code)), code);
  assert.equal(parseGroupCode(' k7pq '), 'K7PQ');
  assert.equal(parseGroupCode('K7-PQ'), 'K7PQ');
  assert.equal(parseGroupCode('Join my Lighthouse group: K7PQ\nOpen lighthouseproto://join/K7PQ'), 'K7PQ');
  assert.equal(parseGroupCode('K0PQ'), null); // 0 is not in the alphabet
  assert.equal(parseGroupCode('hello'), null);
});
