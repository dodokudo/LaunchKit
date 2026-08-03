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

async function withEnv(values, callback) {
  const original = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, values);
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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

test('秘密付きテストURLは30秒後に配信中になる', async () => {
  const testToken = 'test-token';
  const startsAt = Date.parse('2026-08-03T10:00:30.000Z');
  await withEnv({
    SEMINAR_TEST_TOKEN: testToken,
    SEMINAR_TEST_EXPIRES_AT: '2026-08-03T15:00:00.000Z',
  }, async () => {
    await withNow('2026-08-03T10:00:00.000Z', async () => {
      const res = responseRecorder();
      await handler({
        method: 'GET',
        url: `/api/video/access?test=${testToken}&startsAt=${startsAt}`,
      }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'waiting');
      assert.equal(res.body.testMode, true);
      assert.equal(res.body.session.startsAt, '2026-08-03T10:00:30.000Z');
      assert.equal(res.body.playbackToken, undefined);
    });
  });
});

test('無効なテストURLは通常配信の状態を返さない', async () => {
  await withEnv({
    SEMINAR_TEST_TOKEN: 'valid-token',
    SEMINAR_TEST_EXPIRES_AT: '2026-08-03T15:00:00.000Z',
  }, async () => {
    await withNow('2026-08-03T10:00:00.000Z', async () => {
      const res = responseRecorder();
      await handler({
        method: 'GET',
        url: '/api/video/access?test=invalid-token&startsAt=1785751230000',
      }, res);
      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.body, { error: 'not_found' });
    });
  });
});

test('配信中だけ終了時刻まで有効なMux再生トークンを返す', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const originalEnv = {
    playbackId: process.env.MUX_PLAYBACK_ID,
    signingKeyId: process.env.MUX_SIGNING_KEY_ID,
    privateKey: process.env.MUX_SIGNING_PRIVATE_KEY_BASE64,
    testToken: process.env.SEMINAR_TEST_TOKEN,
    testExpiresAt: process.env.SEMINAR_TEST_EXPIRES_AT,
  };
  process.env.MUX_PLAYBACK_ID = 'signed-playback-id';
  process.env.MUX_SIGNING_KEY_ID = 'signing-key-id';
  process.env.MUX_SIGNING_PRIVATE_KEY_BASE64 = Buffer.from(
    privateKey.export({ type: 'pkcs1', format: 'pem' }),
  ).toString('base64');
  process.env.SEMINAR_TEST_TOKEN = 'test-token';
  process.env.SEMINAR_TEST_EXPIRES_AT = '2026-08-03T15:00:00.000Z';

  try {
    await withNow('2026-07-15T04:10:00.000Z', async () => {
      const res = responseRecorder();
      await handler({ method: 'GET' }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'live');
      assert.equal(res.body.playbackId, 'signed-playback-id');
      const [encodedHeader, encodedPayload, encodedSignature] = res.body.playbackToken.split('.');
      const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      assert.deepEqual(header, { alg: 'RS256', typ: 'JWT', kid: 'signing-key-id' });
      assert.equal(payload.sub, 'signed-playback-id');
      assert.equal(payload.aud, 'v');
      assert.equal(payload.exp, Math.floor(Date.parse(res.body.session.endsAt) / 1000) + 300);
      assert.equal(crypto.verify(
        'RSA-SHA256',
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        publicKey,
        Buffer.from(encodedSignature, 'base64url'),
      ), true);
    });

    await withNow('2026-08-03T10:00:31.000Z', async () => {
      const res = responseRecorder();
      await handler({
        method: 'GET',
        url: '/api/video/access?test=test-token&startsAt=1785751230000',
      }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'live');
      assert.equal(res.body.testMode, true);
      assert.equal(res.body.playbackId, 'signed-playback-id');
      assert.equal(res.body.playbackToken.split('.').length, 3);
    });
  } finally {
    if (originalEnv.playbackId === undefined) delete process.env.MUX_PLAYBACK_ID;
    else process.env.MUX_PLAYBACK_ID = originalEnv.playbackId;
    if (originalEnv.signingKeyId === undefined) delete process.env.MUX_SIGNING_KEY_ID;
    else process.env.MUX_SIGNING_KEY_ID = originalEnv.signingKeyId;
    if (originalEnv.privateKey === undefined) delete process.env.MUX_SIGNING_PRIVATE_KEY_BASE64;
    else process.env.MUX_SIGNING_PRIVATE_KEY_BASE64 = originalEnv.privateKey;
    if (originalEnv.testToken === undefined) delete process.env.SEMINAR_TEST_TOKEN;
    else process.env.SEMINAR_TEST_TOKEN = originalEnv.testToken;
    if (originalEnv.testExpiresAt === undefined) delete process.env.SEMINAR_TEST_EXPIRES_AT;
    else process.env.SEMINAR_TEST_EXPIRES_AT = originalEnv.testExpiresAt;
  }
});
