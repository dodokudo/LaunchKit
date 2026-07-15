'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { createV4ReadUrl } = require('../lib/gcs-signed-url');

test('期限付きのGCS V4読み取りURLを生成する', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const url = new URL(createV4ReadUrl({
    bucket: 'private-bucket',
    objectName: 'launchkit/1/video.mp4',
    expiresInSeconds: 600,
    serviceAccount: {
      client_email: 'video@example.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    },
    now: new Date('2026-07-15T04:00:00.000Z'),
  }));

  assert.equal(url.origin, 'https://storage.googleapis.com');
  assert.equal(url.pathname, '/private-bucket/launchkit/1/video.mp4');
  assert.equal(url.searchParams.get('x-goog-expires'), '600');
  assert.equal(url.searchParams.get('x-goog-date'), '20260715T040000Z');
  assert.match(url.searchParams.get('x-goog-signature'), /^[a-f0-9]+$/);
});
