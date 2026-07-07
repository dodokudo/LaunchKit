'use strict';

const crypto = require('crypto');

const MAX_BYTES = 8 * 1024 * 1024;
const BUCKET_NAME = process.env.LAUNCHKIT_UPLOAD_BUCKET || 'analyca-media';
const OBJECT_PREFIX = process.env.LAUNCHKIT_UPLOAD_PREFIX || 'launchkit/uploads/images';

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function safeUploadName(originalName) {
  const parsed = String(originalName || 'image').split(/[\\/]/).pop().split('.');
  if (parsed.length > 1) parsed.pop();
  const base = parsed.join('.')
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return (base || 'image').toLowerCase();
}

function extensionFromMime(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return null;
}

function getServiceAccount() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is missing');
  return JSON.parse(raw);
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken() {
  const serviceAccount = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'token_request_failed');
  }
  return data.access_token;
}

async function uploadToGcs({ objectName, buffer, mimeType }) {
  const token = await getAccessToken();
  const uploadUrl = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o`);
  uploadUrl.searchParams.set('uploadType', 'media');
  uploadUrl.searchParams.set('name', objectName);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: buffer,
  });
  const uploadBody = await uploadResponse.text();
  if (!uploadResponse.ok) {
    throw new Error(uploadBody || 'gcs_upload_failed');
  }

  const aclResponse = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o/${encodeURIComponent(objectName)}/acl`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entity: 'allUsers', role: 'READER' }),
    }
  );
  if (!aclResponse.ok) {
    const aclBody = await aclResponse.text();
    console.warn('GCS ACL update skipped:', aclBody || aclResponse.status);
  }
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const { filename, dataUrl } = await readJsonBody(req);
    if (!filename || typeof filename !== 'string' || !dataUrl || typeof dataUrl !== 'string') {
      return json(res, 400, { error: 'invalid_payload' });
    }

    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      return json(res, 400, { error: 'unsupported_image_type' });
    }

    const mimeType = match[1];
    const ext = extensionFromMime(mimeType);
    const buffer = Buffer.from(match[2], 'base64');
    if (!ext || buffer.length === 0) {
      return json(res, 400, { error: 'invalid_image' });
    }
    if (buffer.length > MAX_BYTES) {
      return json(res, 400, { error: 'image_too_large' });
    }

    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
    const id = crypto.randomUUID().slice(0, 8);
    const objectName = `${OBJECT_PREFIX}/${stamp}-${id}-${safeUploadName(filename)}.${ext}`;

    await uploadToGcs({ objectName, buffer, mimeType });

    return json(res, 200, {
      ok: true,
      public: true,
      url: `https://storage.googleapis.com/${BUCKET_NAME}/${objectName}`,
      path: `/${objectName}`,
      bytes: buffer.length,
      mimeType,
    });
  } catch (error) {
    console.error('Image upload failed:', error);
    return json(res, 500, { error: 'failed_to_upload_image' });
  }
};
