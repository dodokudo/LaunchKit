'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { VIDEO_DURATION_MS, getSeminarState } = require('../lib/seminar-schedule');

function atJst(value) {
  return Date.parse(`${value}+09:00`);
}

test('13時回は12:50から待機し、13:00から動画終了までライブになる', () => {
  assert.equal(getSeminarState(atJst('2026-07-15T12:49:59')).status, 'closed');
  assert.equal(getSeminarState(atJst('2026-07-15T12:50:00')).status, 'waiting');

  const live = getSeminarState(atJst('2026-07-15T13:00:00'));
  assert.equal(live.status, 'live');
  assert.equal(live.session.endsAtMs, live.session.startsAtMs + VIDEO_DURATION_MS);

  assert.equal(getSeminarState(live.session.endsAtMs - 1).status, 'live');
  assert.equal(getSeminarState(live.session.endsAtMs).status, 'closed');
});

test('21時回は20:50から待機し、21:00から動画終了までライブになる', () => {
  assert.equal(getSeminarState(atJst('2026-07-15T20:49:59')).status, 'closed');
  assert.equal(getSeminarState(atJst('2026-07-15T20:50:00')).status, 'waiting');
  assert.equal(getSeminarState(atJst('2026-07-15T21:00:00')).status, 'live');
  assert.equal(getSeminarState(atJst('2026-07-15T23:02:21.461')).status, 'closed');
});

test('最終回終了後は翌日13時回を次回として返す', () => {
  const state = getSeminarState(atJst('2026-07-15T23:30:00'));
  assert.equal(state.status, 'closed');
  assert.equal(state.nextSession.startsAtMs, atJst('2026-07-16T13:00:00'));
});
