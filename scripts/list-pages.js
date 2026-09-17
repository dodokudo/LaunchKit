'use strict';

const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');

// List actual page entry points at any depth, never asset-only directories.
async function discoverPages(distDir) {
  const excluded = new Set(['assets', 'list', 'admin', 'uploads', 'css', 'js', 'images', 'fonts', 'images-q90', 'images-webp']);
  const pages = [];
  async function visit(dir, slug) {
    if (slug && await fs.pathExists(path.join(dir, 'index.html'))) {
      const $ = cheerio.load(await fs.readFile(path.join(dir, 'index.html'), 'utf8'));
      pages.push({ slug, title: $('title').first().text().replace(/\s+/g, ' ').trim() || slug });
    }
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && !excluded.has(entry.name)) {
        await visit(path.join(dir, entry.name), slug ? `${slug}/${entry.name}` : entry.name);
      }
    }
  }
  await visit(distDir, '');
  return pages.sort((a, b) => a.slug.localeCompare(b.slug));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

module.exports = { discoverPages, escapeHtml };
