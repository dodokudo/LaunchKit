'use strict';

const { createV4ReadUrl } = require('../../lib/gcs-signed-url');
const { VIDEO_DURATION_MS, getSeminarState } = require('../../lib/seminar-schedule');

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
  const state = getSeminarState(nowMs);
  const body = {
    status: state.status,
    serverNow: new Date(nowMs).toISOString(),
    durationMs: VIDEO_DURATION_MS,
    session: publicSession(state.session),
    nextSession: publicSession(state.nextSession),
  };

  if (state.status !== 'live') return sendJson(res, 200, body);

  try {
    const bucket = process.env.SEMINAR_VIDEO_BUCKET;
    const objectName = process.env.SEMINAR_VIDEO_OBJECT || 'launchkit/1/video1198029083.mp4';
    const serviceAccount = JSON.parse(process.env.SEMINAR_VIDEO_CREDENTIALS_JSON || '{}');
    const expiresInSeconds = (state.session.endsAtMs - nowMs) / 1000;
    body.videoUrl = createV4ReadUrl({
      bucket,
      objectName,
      expiresInSeconds,
      serviceAccount,
      now: new Date(nowMs),
    });
    return sendJson(res, 200, body);
  } catch (error) {
    console.error('Failed to create seminar video URL:', error);
    return sendJson(res, 500, { error: 'video_unavailable' });
  }
};
