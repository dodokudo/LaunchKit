'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const VIDEO_DURATION_MS = 7_341_461;
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist', '1');
const videoPath = process.argv[2];
const port = Number(process.env.PORT || 4173);

if (!videoPath || !fs.existsSync(videoPath)) {
  throw new Error('usage: node scripts/preview-seminar.js <video.mp4>');
}

let sessionStartsAtMs = null;
let comments = [];

function sessionStart(now = Date.now()) {
  if (sessionStartsAtMs === null) sessionStartsAtMs = now;
  return sessionStartsAtMs;
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(body));
}

function serveFile(req, res, filePath, contentType) {
  const { size } = fs.statSync(filePath);
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': size,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const match = range.match(/bytes=(\d*)-(\d*)/);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  res.writeHead(206, {
    'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Type': contentType,
  });
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const now = Date.now();

  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/1/' });
    res.end();
    return;
  }

  if (url.pathname === '/api/video/access') {
    const startsAt = sessionStart(now);
    sendJson(res, 200, {
      status: 'live',
      serverNow: new Date(now).toISOString(),
      durationMs: VIDEO_DURATION_MS,
      session: {
        startsAt: new Date(startsAt).toISOString(),
        joinOpensAt: new Date(startsAt - 600_000).toISOString(),
        endsAt: new Date(startsAt + VIDEO_DURATION_MS).toISOString(),
      },
      nextSession: null,
      videoUrl: '/preview/video.mp4',
    });
    return;
  }

  if (url.pathname === '/api/video/comments') {
    const startsAt = sessionStart(now);
    if (req.method === 'GET') {
      sendJson(res, 200, { sessionStartsAt: new Date(startsAt).toISOString(), comments });
      return;
    }
    if (req.method === 'POST') {
      try {
        const input = await readJson(req);
        const message = String(input.message || '').trim().slice(0, 200);
        if (message) {
          comments = [...comments, {
            id: `local-${Date.now()}`,
            name: String(input.name || '').trim().slice(0, 20) || '匿名',
            message,
            createdAt: new Date().toISOString(),
          }];
        }
        sendJson(res, 201, { sessionStartsAt: new Date(startsAt).toISOString(), comments });
      } catch (error) {
        sendJson(res, 400, { error: 'invalid_request' });
      }
      return;
    }
  }

  if (url.pathname === '/preview/video.mp4') {
    serveFile(req, res, videoPath, 'video/mp4');
    return;
  }

  if (url.pathname === '/1/' || url.pathname === '/1/index.html') {
    serveFile(req, res, path.join(distDir, 'index.html'), 'text/html; charset=utf-8');
    return;
  }

  if (url.pathname === '/1/seminar-chat.json') {
    serveFile(req, res, path.join(distDir, 'seminar-chat.json'), 'application/json; charset=utf-8');
    return;
  }

  if (url.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/meta-pixel.js') {
    res.writeHead(204, { 'Content-Type': 'application/javascript' });
    res.end();
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Seminar preview: http://localhost:${port}/1/`);
  console.log('The preview clock starts when the page first requests access.');
  console.log('Preview comments are kept only in memory and are not written to production storage.');
});
