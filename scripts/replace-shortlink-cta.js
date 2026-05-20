#!/usr/bin/env node
'use strict';

/*
 * LP HTML 内の autostudio-self.vercel.app/l/{code} (リダイレクト計測URL)を
 * BigQuery short_links の destination_url (liff.line.me 直リンク) に置換する。
 * 同時に data-launchkit-line-cta 属性が無ければ追加して、launchkit_events で
 * line_cta_click が計測されるようにする。
 *
 * Usage:
 *   1. node scripts/dump-line-shortlinks.js > /tmp/line-short-links.json で
 *      BQ から short_code → destination_url のマップを作っておく
 *      (もしくは事前に bq query で /tmp/line-short-links.json に出力)
 *   2. node scripts/replace-shortlink-cta.js
 */

const fs = require('fs');
const path = require('path');

const MAP_PATH = process.env.LK_SHORTLINK_MAP ?? '/tmp/line-short-links.json';

function buildMap() {
  if (!fs.existsSync(MAP_PATH)) {
    console.error(`map not found: ${MAP_PATH}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const map = new Map();
  for (const row of raw) {
    if (!row.short_code || !row.destination_url) continue;
    map.set(row.short_code, row.destination_url);
  }
  return map;
}

function walk(dir, exts, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(e.name))) out.push(full);
  }
}

function ensureCtaAttribute(html, anchorStart, anchorEndExclusive) {
  // anchorStart .. anchorEndExclusive で <a ... > 開始タグ全体 (>を含まない部分まで)
  const tagBody = html.slice(anchorStart, anchorEndExclusive);
  if (tagBody.includes('data-launchkit-line-cta')) return html; // 既にある
  // 開始タグ末尾(>)の手前に data-launchkit-line-cta を差し込む
  return html.slice(0, anchorEndExclusive) + ' data-launchkit-line-cta' + html.slice(anchorEndExclusive);
}

function main() {
  const map = buildMap();
  console.log(`shortlink map size: ${map.size}`);

  const root = path.resolve(__dirname, '..');
  const files = [];
  walk(path.join(root, 'content'), ['.html'], files);
  for (const name of ['threads-guide', 'threads-guide-2', 'course1', '3mR', 'seminar', 'seminar2', 'seminar3', 'seminar4']) {
    walk(path.join(root, name), ['.html'], files);
  }

  const SHORT_HOST_RE = /(https?:\/\/(?:autostudio-self\.vercel\.app|asto\.jp)\/l\/([^"'\s<>?#]+))/g;
  // <a タグ全体の正規表現 (開始タグのみ)
  const A_TAG_RE = /<a\b[^>]*>/gi;

  let totalReplacements = 0;
  let totalAttrAdds = 0;
  const unresolved = new Set();

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    let changed = false;

    // 各 <a> 開始タグについて、href が SHORT_HOST_RE にマッチしたら置換 + 属性付与
    const newHtml = html.replace(A_TAG_RE, (match) => {
      let updatedTag = match;
      updatedTag = updatedTag.replace(SHORT_HOST_RE, (full, _url, code) => {
        const dest = map.get(code);
        if (!dest) {
          unresolved.add(code);
          return full;
        }
        totalReplacements += 1;
        return dest;
      });
      if (updatedTag !== match && !/data-launchkit-line-cta/.test(updatedTag)) {
        // 末尾 > の前に属性追加
        updatedTag = updatedTag.replace(/>$/, ' data-launchkit-line-cta>');
        totalAttrAdds += 1;
      }
      if (updatedTag !== match) changed = true;
      return updatedTag;
    });

    if (changed) {
      fs.writeFileSync(file, newHtml, 'utf8');
      console.log('  + ' + path.relative(root, file));
    }
  }

  console.log(`\nReplaced ${totalReplacements} hrefs, added ${totalAttrAdds} CTA attrs`);
  if (unresolved.size) {
    console.warn('Unresolved short codes (no destination in map):');
    for (const c of unresolved) console.warn('  - ' + c);
  }
}

main();
