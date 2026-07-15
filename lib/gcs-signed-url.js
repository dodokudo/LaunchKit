'use strict';

const crypto = require('crypto');

function encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function formatSigningTime(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function createV4ReadUrl({
  bucket,
  objectName,
  expiresInSeconds,
  serviceAccount,
  region = 'asia-northeast1',
  now = new Date(),
}) {
  if (!bucket || !objectName) throw new Error('Video storage location is missing');
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error('Service account credentials are missing');
  }

  const expires = Math.min(604800, Math.max(1, Math.ceil(expiresInSeconds)));
  const signingTime = formatSigningTime(now);
  const datestamp = signingTime.slice(0, 8);
  const credentialScope = `${datestamp}/${region}/storage/goog4_request`;
  const host = 'storage.googleapis.com';
  const canonicalUri = `/${encode(bucket)}/${objectName.split('/').map(encode).join('/')}`;
  const query = {
    'x-goog-algorithm': 'GOOG4-RSA-SHA256',
    'x-goog-credential': `${serviceAccount.client_email}/${credentialScope}`,
    'x-goog-date': signingTime,
    'x-goog-expires': String(expires),
    'x-goog-signedheaders': 'host',
  };
  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join('&');
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'GOOG4-RSA-SHA256',
    signingTime,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(stringToSign), serviceAccount.private_key)
    .toString('hex');

  return `https://${host}${canonicalUri}?${canonicalQuery}&x-goog-signature=${signature}`;
}

module.exports = { createV4ReadUrl };
