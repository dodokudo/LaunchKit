'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { VIDEO_DURATION_MS, getSeminarState } = require('../lib/seminar-schedule');

function atJst(value) {
  return Date.parse(`${value}+09:00`);
}

test('10時回は9:50から待機し、10:00から動画終了までライブになる', () => {
  const closed = getSeminarState(atJst('2026-07-15T09:49:59'));
  assert.equal(closed.status, 'closed');
  assert.equal(closed.nextSession.startsAtMs, atJst('2026-07-15T10:00:00'));
  assert.equal(getSeminarState(atJst('2026-07-15T09:50:00')).status, 'waiting');
  assert.equal(getSeminarState(atJst('2026-07-15T09:59:59')).status, 'waiting');

  const live = getSeminarState(atJst('2026-07-15T10:00:00'));
  assert.equal(live.status, 'live');
  assert.equal(live.session.startsAtMs, atJst('2026-07-15T10:00:00'));
  assert.equal(live.session.endsAtMs, live.session.startsAtMs + VIDEO_DURATION_MS);
  assert.equal(getSeminarState(live.session.endsAtMs - 1).status, 'live');

  const ended = getSeminarState(live.session.endsAtMs);
  assert.equal(ended.status, 'closed');
  assert.equal(ended.nextSession.startsAtMs, atJst('2026-07-15T13:00:00'));
});

test('13時回は12:50から待機し、13:00から動画終了までライブになる', () => {
  assert.equal(getSeminarState(atJst('2026-07-15T12:49:59')).status, 'closed');
  assert.equal(getSeminarState(atJst('2026-07-15T12:50:00')).status, 'waiting');

  const live = getSeminarState(atJst('2026-07-15T13:00:00'));
  assert.equal(live.status, 'live');
  assert.equal(live.session.endsAtMs, live.session.startsAtMs + VIDEO_DURATION_MS);

  assert.equal(getSeminarState(live.session.endsAtMs - 1).status, 'live');
  assert.equal(getSeminarState(live.session.endsAtMs).status, 'closed');
});

test('20時回は19:50から待機し、20:00から動画終了までライブになる', () => {
  const closed = getSeminarState(atJst('2026-07-15T19:49:59'));
  assert.equal(closed.status, 'closed');
  assert.equal(closed.nextSession.startsAtMs, atJst('2026-07-15T20:00:00'));
  assert.equal(getSeminarState(atJst('2026-07-15T19:50:00')).status, 'waiting');
  assert.equal(getSeminarState(atJst('2026-07-15T19:59:59')).status, 'waiting');
  const live = getSeminarState(atJst('2026-07-15T20:00:00'));
  assert.equal(live.status, 'live');
  assert.equal(live.session.startsAtMs, atJst('2026-07-15T20:00:00'));
  assert.equal(getSeminarState(atJst('2026-07-15T21:00:00')).session.startsAtMs, live.session.startsAtMs);
  assert.equal(getSeminarState(atJst('2026-07-15T22:02:21.460')).status, 'live');
  assert.equal(getSeminarState(atJst('2026-07-15T22:02:21.461')).status, 'closed');
});

test('最終回終了後は翌日10時回を次回として返す', () => {
  const state = getSeminarState(atJst('2026-07-15T23:30:00'));
  assert.equal(state.status, 'closed');
  assert.equal(state.nextSession.startsAtMs, atJst('2026-07-16T10:00:00'));
});
