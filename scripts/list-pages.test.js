'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { discoverPages, escapeHtml } = require('./list-pages');

test('discovers nested and newly deployed pages, excluding asset directories', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'launchkit-pages-'));
  try {
    for (const slug of ['report', 'report/2026/student', 'assets', 'report/assets', 'list', 'admin']) {
      await fs.outputFile(path.join(root, slug, 'index.html'), '<title>受講生 &amp; 自分のデータ</title>');
    }
    await fs.outputFile(path.join(root, 'empty/image.png'), 'image');
    assert.deepEqual((await discoverPages(root)).map(p => p.slug), ['report', 'report/2026/student']);
    assert.equal((await discoverPages(root))[0].title, '受講生 & 自分のデータ');
    await fs.outputFile(path.join(root, 'new-page/index.html'), '<title>新ページ</title>');
    assert.ok((await discoverPages(root)).some(p => p.slug === 'new-page' && p.title === '新ページ'));
    await fs.remove(path.join(root, 'report'));
    assert.deepEqual((await discoverPages(root)).map(p => p.slug), ['new-page']);
    assert.equal(escapeHtml('<"&\'>'), '&lt;&quot;&amp;&#39;&gt;');
  } finally {
    await fs.remove(root);
  }
});
