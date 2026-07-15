'use strict';

const crypto = require('crypto');

const MAX_COMMENTS = 200;
const MAX_MESSAGE_LENGTH = 200;
const MAX_NAME_LENGTH = 20;

function normalizeCommentInput(input) {
  const name = String(input?.name || '').trim().slice(0, MAX_NAME_LENGTH) || '匿名';
  const message = String(input?.message || '').trim();
  if (!message) throw new Error('message_required');
  if (message.length > MAX_MESSAGE_LENGTH) throw new Error('message_too_long');
  if (String(input?.website || '').trim()) throw new Error('spam_detected');
  return { name, message };
}

function sessionObjectName(session) {
  const start = new Date(session.startsAtMs).toISOString().replace(/[:.]/g, '-');
  return `sessions/${start}.json`;
}

function objectUrl(bucket, objectName, query = '') {
  return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}${query}`;
}

async function readComments({ bucket, objectName, token }) {
  const response = await fetch(objectUrl(bucket, objectName, '?alt=media'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return { comments: [], generation: null };
  if (!response.ok) throw new Error(`comments_read_failed:${response.status}`);

  const data = await response.json();
  return {
    comments: Array.isArray(data.comments) ? data.comments.slice(-MAX_COMMENTS) : [],
    generation: response.headers.get('x-goog-generation'),
  };
}

async function writeComments({ bucket, objectName, token, comments, generation }) {
  const url = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o`);
  url.searchParams.set('uploadType', 'media');
  url.searchParams.set('name', objectName);
  url.searchParams.set('ifGenerationMatch', generation || '0');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
    body: JSON.stringify({ comments: comments.slice(-MAX_COMMENTS) }),
  });
  if (response.status === 412) return false;
  if (!response.ok) throw new Error(`comments_write_failed:${response.status}`);
  return true;
}

async function appendComment({ bucket, objectName, token, name, message, nowMs }) {
  const comment = {
    id: crypto.randomUUID(),
    name,
    message,
    createdAt: new Date(nowMs).toISOString(),
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await readComments({ bucket, objectName, token });
    const comments = [...current.comments, comment];
    const written = await writeComments({
      bucket,
      objectName,
      token,
      comments,
      generation: current.generation,
    });
    if (written) return comments.slice(-MAX_COMMENTS);
  }
  throw new Error('comments_write_conflict');
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  appendComment,
  normalizeCommentInput,
  readComments,
  sessionObjectName,
};
