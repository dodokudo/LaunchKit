'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const handler = require('../api/video/access');

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value) {
      this.body = JSON.parse(value);
    },
  };
}

async function withNow(now, callback) {
  const originalNow = Date.now;
  Date.now = () => Date.parse(now);
  try {
    return await callback();
  } finally {
    Date.now = originalNow;
  }
}

test('待機中は動画URLを返さない', async () => {
  await withNow('2026-07-15T03:55:00.000Z', async () => {
    const res = responseRecorder();
    await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'waiting');
    assert.equal(res.body.videoUrl, undefined);
  });
});

test('配信中だけ終了時刻まで有効な動画URLを返す', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const originalEnv = {
    bucket: process.env.SEMINAR_VIDEO_BUCKET,
    object: process.env.SEMINAR_VIDEO_OBJECT,
    credentials: process.env.SEMINAR_VIDEO_CREDENTIALS_JSON,
  };
  process.env.SEMINAR_VIDEO_BUCKET = 'private-bucket';
  process.env.SEMINAR_VIDEO_OBJECT = 'launchkit/1/video.mp4';
  process.env.SEMINAR_VIDEO_CREDENTIALS_JSON = JSON.stringify({
    client_email: 'video@example.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });

  try {
    await withNow('2026-07-15T04:10:00.000Z', async () => {
      const res = responseRecorder();
      await handler({ method: 'GET' }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'live');
      assert.match(res.body.videoUrl, /^https:\/\/storage\.googleapis\.com\/private-bucket\//);
      assert.ok(Number(new URL(res.body.videoUrl).searchParams.get('x-goog-expires')) > 0);
    });
  } finally {
    if (originalEnv.bucket === undefined) delete process.env.SEMINAR_VIDEO_BUCKET;
    else process.env.SEMINAR_VIDEO_BUCKET = originalEnv.bucket;
    if (originalEnv.object === undefined) delete process.env.SEMINAR_VIDEO_OBJECT;
    else process.env.SEMINAR_VIDEO_OBJECT = originalEnv.object;
    if (originalEnv.credentials === undefined) delete process.env.SEMINAR_VIDEO_CREDENTIALS_JSON;
    else process.env.SEMINAR_VIDEO_CREDENTIALS_JSON = originalEnv.credentials;
  }
});
