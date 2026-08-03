'use strict';

const { getGoogleAccessToken } = require('../../lib/google-access-token');
const {
  appendComment,
  normalizeCommentInput,
  readComments,
  sessionObjectName,
} = require('../../lib/seminar-comments');
const { getSeminarState } = require('../../lib/seminar-schedule');
const { getTestSeminarState } = require('../../lib/seminar-test-session');

const STORAGE_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const nowMs = Date.now();
  const testResult = getTestSeminarState(req, nowMs);
  if (testResult?.error) return sendJson(res, 404, { error: testResult.error });

  const state = testResult?.state || getSeminarState(nowMs);
  if (state.status !== 'waiting' && state.status !== 'live') {
    return sendJson(res, 403, { error: 'comments_closed', status: state.status });
  }

  try {
    const bucket = process.env.SEMINAR_COMMENTS_BUCKET;
    const credentials = JSON.parse(process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON || '{}');
    const token = await getGoogleAccessToken(credentials, STORAGE_SCOPE);
    const sessionPath = sessionObjectName(state.session);
    const objectName = testResult?.testMode ? `tests/${sessionPath}` : sessionPath;

    if (req.method === 'GET') {
      const current = await readComments({ bucket, objectName, token });
      return sendJson(res, 200, {
        status: state.status,
        sessionStartsAt: new Date(state.session.startsAtMs).toISOString(),
        comments: current.comments,
      });
    }

    const input = normalizeCommentInput(await readJsonBody(req));
    const comments = await appendComment({
      bucket,
      objectName,
      token,
      ...input,
      nowMs,
    });
    return sendJson(res, 201, { ok: true, comments });
  } catch (error) {
    if (['message_required', 'message_too_long', 'spam_detected'].includes(error.message)) {
      return sendJson(res, 400, { error: error.message });
    }
    console.error('Seminar comments failed:', error);
    return sendJson(res, 500, { error: 'comments_unavailable' });
  }
};
