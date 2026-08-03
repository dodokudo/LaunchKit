'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const commentsHandler = require('../api/video/comments');
const {
  normalizeCommentInput,
  sessionObjectName,
} = require('../lib/seminar-comments');

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

test('コメント入力を制限し、未入力の表示名は匿名にする', () => {
  assert.deepEqual(normalizeCommentInput({ name: '  ', message: ' 参考になりました ' }), {
    name: '匿名',
    message: '参考になりました',
  });
  assert.throws(() => normalizeCommentInput({ message: '' }), /message_required/);
  assert.throws(() => normalizeCommentInput({ message: 'a'.repeat(201) }), /message_too_long/);
  assert.throws(() => normalizeCommentInput({ message: 'test', website: 'bot' }), /spam_detected/);
});

test('コメント保存先を開催回ごとに分離する', () => {
  const objectName = sessionObjectName({ startsAtMs: Date.parse('2026-07-15T12:00:00.000Z') });
  assert.equal(objectName, 'sessions/2026-07-15T12-00-00-000Z.json');
});

test('待機中の実コメントをGCSへ保存する', async () => {
  const originalNow = Date.now;
  const originalFetch = global.fetch;
  const originalEnv = {
    bucket: process.env.SEMINAR_COMMENTS_BUCKET,
    credentials: process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON,
  };
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const calls = [];
  Date.now = () => Date.parse('2026-07-15T03:55:00.000Z');
  process.env.SEMINAR_COMMENTS_BUCKET = 'comments-bucket';
  process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON = JSON.stringify({
    client_email: 'comments@example.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('oauth2.googleapis.com/token')) {
      assert.equal(
        options.body.get('grant_type'),
        'urn:ietf:params:oauth:grant-type:jwt-bearer'
      );
      return new Response(JSON.stringify({ access_token: 'test-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (options.method === 'POST') {
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const res = responseRecorder();
    await commentsHandler({
      method: 'POST',
      body: { name: '山田', message: '勉強になります', website: '' },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.comments.length, 1);
    assert.equal(res.body.comments[0].name, '山田');
    assert.equal(res.body.comments[0].message, '勉強になります');

    const upload = calls.find((call) => call.options.method === 'POST' && call.url.includes('upload/storage'));
    assert.ok(upload);
    assert.match(upload.url, /ifGenerationMatch=0/);
    assert.match(upload.url, /sessions%2F2026-07-15T04-00-00-000Z\.json/);
  } finally {
    Date.now = originalNow;
    global.fetch = originalFetch;
    if (originalEnv.bucket === undefined) delete process.env.SEMINAR_COMMENTS_BUCKET;
    else process.env.SEMINAR_COMMENTS_BUCKET = originalEnv.bucket;
    if (originalEnv.credentials === undefined) delete process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON;
    else process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON = originalEnv.credentials;
  }
});

test('入室時間外はコメントを保存しない', async () => {
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-07-15T02:00:00.000Z');
  try {
    const res = responseRecorder();
    await commentsHandler({ method: 'POST', body: { message: 'test' } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'comments_closed');
  } finally {
    Date.now = originalNow;
  }
});

test('秘密付きテスト回のコメントを本番開催回と分けて保存する', async () => {
  const originalNow = Date.now;
  const originalFetch = global.fetch;
  const originalEnv = {
    bucket: process.env.SEMINAR_COMMENTS_BUCKET,
    credentials: process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON,
    testToken: process.env.SEMINAR_TEST_TOKEN,
    testExpiresAt: process.env.SEMINAR_TEST_EXPIRES_AT,
  };
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const calls = [];
  const startsAt = Date.parse('2026-08-03T10:00:30.000Z');
  Date.now = () => Date.parse('2026-08-03T10:00:00.000Z');
  process.env.SEMINAR_COMMENTS_BUCKET = 'comments-bucket';
  process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON = JSON.stringify({
    client_email: 'comments@example.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  process.env.SEMINAR_TEST_TOKEN = 'test-token';
  process.env.SEMINAR_TEST_EXPIRES_AT = '2026-08-03T15:00:00.000Z';
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'test-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (options.method === 'POST') {
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const res = responseRecorder();
    await commentsHandler({
      method: 'POST',
      url: `/api/video/comments?test=test-token&startsAt=${startsAt}`,
      body: { name: 'テスト視聴者', message: '入力できます', website: '' },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.comments[0].message, '入力できます');
    const upload = calls.find((call) => call.options.method === 'POST' && call.url.includes('upload/storage'));
    assert.ok(upload);
    assert.match(upload.url, /tests%2Fsessions%2F2026-08-03T10-00-30-000Z\.json/);
  } finally {
    Date.now = originalNow;
    global.fetch = originalFetch;
    if (originalEnv.bucket === undefined) delete process.env.SEMINAR_COMMENTS_BUCKET;
    else process.env.SEMINAR_COMMENTS_BUCKET = originalEnv.bucket;
    if (originalEnv.credentials === undefined) delete process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON;
    else process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON = originalEnv.credentials;
    if (originalEnv.testToken === undefined) delete process.env.SEMINAR_TEST_TOKEN;
    else process.env.SEMINAR_TEST_TOKEN = originalEnv.testToken;
    if (originalEnv.testExpiresAt === undefined) delete process.env.SEMINAR_TEST_EXPIRES_AT;
    else process.env.SEMINAR_TEST_EXPIRES_AT = originalEnv.testExpiresAt;
  }
});
