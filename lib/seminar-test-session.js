'use strict';

const crypto = require('node:crypto');
const { VIDEO_DURATION_MS } = require('./seminar-schedule');

const TEST_START_LEAD_MS = 30 * 1000;
const TEST_START_WINDOW_MS = 5 * 60 * 1000;

function secureTokenMatches(actual, expected) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function getTestSeminarState(req, nowMs) {
  const url = new URL(req.url || '/', 'https://lkit.jp');
  const testToken = url.searchParams.get('test');
  if (!testToken) return null;

  const configuredToken = (process.env.SEMINAR_TEST_TOKEN || '').trim();
  const expiresAtMs = Date.parse((process.env.SEMINAR_TEST_EXPIRES_AT || '').trim());
  const startsAtMs = Number(url.searchParams.get('startsAt'));
  const validStart = Number.isFinite(startsAtMs)
    && startsAtMs <= nowMs + TEST_START_WINDOW_MS
    && startsAtMs >= nowMs - VIDEO_DURATION_MS - TEST_START_WINDOW_MS;

  if (!secureTokenMatches(testToken, configuredToken)
    || !Number.isFinite(expiresAtMs)
    || nowMs >= expiresAtMs
    || !validStart) {
    return { error: 'not_found' };
  }

  const session = {
    startsAtMs,
    joinOpensAtMs: startsAtMs - TEST_START_LEAD_MS,
    endsAtMs: startsAtMs + VIDEO_DURATION_MS,
  };
  const status = nowMs < startsAtMs
    ? 'waiting'
    : nowMs < session.endsAtMs ? 'live' : 'closed';
  return {
    state: { status, session: status === 'closed' ? null : session, nextSession: null },
    testMode: true,
  };
}

module.exports = {
  getTestSeminarState,
};
