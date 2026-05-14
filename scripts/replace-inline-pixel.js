#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const OLD_START = '<!-- Meta Pixel (LK) -->';
const OLD_END = '<!-- End Meta Pixel (LK) -->';
const NEW_MARKER = '<!-- Meta Pixel (LK) v2 -->';
const NEW_SNIPPET = `${NEW_MARKER}\n<script async src="/meta-pixel.js"></script>\n<!-- End Meta Pixel (LK) v2 -->`;

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

  let replaced = 0;
  let added = 0;
  let alreadyV2 = 0;
  let skipped = 0;
  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes(NEW_MARKER)) { alreadyV2 += 1; continue; }

    // 既存のインライン版を削除
    const sIdx = html.indexOf(OLD_START);
    if (sIdx >= 0) {
      const eIdx = html.indexOf(OLD_END, sIdx);
      if (eIdx >= 0) {
        const before = html.slice(0, sIdx).replace(/\s+$/, '');
        const after = html.slice(eIdx + OLD_END.length).replace(/^\s+/, '\n');
        html = before + '\n' + after;
        replaced += 1;
      }
    }

    // <head> 直後に新方式注入
    const headIdx = html.search(/<head[^>]*>/i);
    if (headIdx < 0) { skipped += 1; continue; }
    const insertAt = html.indexOf('>', headIdx) + 1;
    html = html.slice(0, insertAt) + '\n' + NEW_SNIPPET + '\n' + html.slice(insertAt);
    if (!sIdx || sIdx < 0) added += 1;

    fs.writeFileSync(file, html, 'utf8');
    console.log('  + ' + path.relative(root, file));
  }
  console.log(`\nReplaced inline→src: ${replaced} / Added fresh: ${added} / Already v2: ${alreadyV2} / Skipped: ${skipped}`);
}

main();
