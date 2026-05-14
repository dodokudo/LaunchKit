#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PIXEL_ID = '1428099569345627';
const MARKER = '<!-- Meta Pixel (LK) -->';
const SNIPPET = `${MARKER}
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel (LK) -->`;

function walk(dir, exts, results) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, results);
    else if (exts.includes(path.extname(entry.name))) results.push(full);
  }
}

function main() {
  const root = path.resolve(__dirname, '..');
  const files = [];
  walk(path.join(root, 'content'), ['.html'], files);
  walk(path.join(root, 'admin'), ['.html'], files);
  for (const name of ['threads-guide', 'threads-guide-2', 'course1', '3mR', 'seminar', 'seminar2', 'seminar3', 'seminar4']) {
    walk(path.join(root, name), ['.html'], files);
  }

  let injected = 0;
  let skipped = 0;
  let noHead = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (html.includes(MARKER)) { skipped += 1; continue; }
    const headIdx = html.search(/<head[^>]*>/i);
    if (headIdx < 0) { noHead += 1; continue; }
    const insertAt = html.indexOf('>', headIdx) + 1;
    const next = html.slice(0, insertAt) + '\n' + SNIPPET + '\n' + html.slice(insertAt);
    fs.writeFileSync(file, next, 'utf8');
    injected += 1;
    console.log('  + ' + path.relative(root, file));
  }
  console.log(`\nInjected: ${injected} / Skipped (already): ${skipped} / No <head>: ${noHead}`);
}

main();
