'use strict';

const crypto = require('node:crypto');
const { VIDEO_DURATION_MS, getSeminarState } = require('../../lib/seminar-schedule');
const { getTestSeminarState } = require('../../lib/seminar-test-session');

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createMuxPlaybackToken({ playbackId, signingKeyId, privateKeyBase64, expiresAtSeconds }) {
  if (!playbackId || !signingKeyId || !privateKeyBase64) {
    throw new Error('Mux playback signing configuration is incomplete');
  }

  const encodedHeader = encodeJwtPart({ alg: 'RS256', typ: 'JWT', kid: signingKeyId });
  const encodedPayload = encodeJwtPart({
    sub: playbackId,
    aud: 'v',
    exp: Math.floor(expiresAtSeconds),
  });
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsignedToken), privateKey);
  return `${unsignedToken}.${signature.toString('base64url')}`;
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function publicSession(session) {
  if (!session) return null;
  return {
    startsAt: new Date(session.startsAtMs).toISOString(),
    joinOpensAt: new Date(session.joinOpensAtMs).toISOString(),
    endsAt: new Date(session.endsAtMs).toISOString(),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const nowMs = Date.now();
  const testResult = getTestSeminarState(req, nowMs);
  if (testResult?.error) return sendJson(res, 404, { error: testResult.error });

  const state = testResult?.state || getSeminarState(nowMs);
  const body = {
    status: state.status,
    serverNow: new Date(nowMs).toISOString(),
    durationMs: VIDEO_DURATION_MS,
    session: publicSession(state.session),
    nextSession: publicSession(state.nextSession),
    testMode: Boolean(testResult?.testMode),
  };

  if (state.status !== 'live') return sendJson(res, 200, body);

  try {
    const playbackId = process.env.MUX_PLAYBACK_ID;
    body.playbackId = playbackId;
    body.playbackToken = createMuxPlaybackToken({
      playbackId,
      signingKeyId: process.env.MUX_SIGNING_KEY_ID,
      privateKeyBase64: process.env.MUX_SIGNING_PRIVATE_KEY_BASE64,
      expiresAtSeconds: (state.session.endsAtMs / 1000) + 300,
    });
    return sendJson(res, 200, body);
  } catch (error) {
    console.error('Failed to create seminar video URL:', error);
    return sendJson(res, 500, { error: 'video_unavailable' });
  }
};

module.exports.createMuxPlaybackToken = createMuxPlaybackToken;
