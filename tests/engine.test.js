const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../shared/engine');

const riya = { room: 0, bed: 1, wake: 1, lights: 0, clean: 2, study: 0, friends: 0, sharing: 1, temp: 1, food: 1, smoke: 0, vibe: 1, top: 'bed' };
const sneha = { room: 0, bed: 1, wake: 1, lights: 0, clean: 2, study: 0, friends: 1, sharing: 1, temp: 1, food: 1, smoke: 0, vibe: 1, top: 'bed' };

test('identical answers score 100', () => {
  assert.equal(E.compatibility(riya, riya).score, 100);
});

test('one card apart still scores high', () => {
  const r = E.compatibility(riya, sneha);
  assert.ok(r.score >= 90 && r.score < 100, 'got ' + r.score);
});

test('score is symmetric', () => {
  const other = { ...sneha, bed: 3, clean: 0, top: 'clean' };
  assert.equal(E.compatibility(riya, other).score, E.compatibility(other, riya).score);
});

test('different room type blocks the pair', () => {
  assert.equal(E.compatibility(riya, { ...sneha, room: 1 }).blocked, 'room');
});

test('smoker and smoke free roommate are blocked, "don\'t mind" is not', () => {
  assert.equal(E.compatibility(riya, { ...sneha, smoke: 2 }).blocked, 'smoke');
  assert.equal(E.compatibility({ ...riya, smoke: 1 }, { ...sneha, smoke: 2 }).blocked, undefined);
});

test('skipped cards are ignored', () => {
  const r = E.compatibility({ bed: 0 }, { bed: 0, clean: 0 });
  assert.equal(r.score, 100);
  assert.deepEqual(Object.keys(r.sims), ['bed']);
});

test('no overlapping answers gives no score', () => {
  assert.equal(E.compatibility({ bed: 0 }, { clean: 1 }).score, null);
});

test('top pick doubles that habit for its owner', () => {
  const sims = { bed: 0, clean: 1 };
  const caresAboutBed = E.directional({ top: 'bed' }, sims);
  const caresAboutClean = E.directional({ top: 'clean' }, sims);
  assert.ok(caresAboutClean > caresAboutBed);
});

test('sanitize drops unknown keys and out of range values', () => {
  assert.deepEqual(E.sanitize({ bed: 9, clean: 2, hack: 1, top: 'nope', room: '0' }), { clean: 2 });
});

test('explain names the strongest and weakest habits', () => {
  const r = E.compatibility(riya, sneha);
  const ex = E.explain(r.sims, sneha);
  assert.equal(ex.good.length, 2);
  assert.match(ex.talk, /friends in the room/);
});
