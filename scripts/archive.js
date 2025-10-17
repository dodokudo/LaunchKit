#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

async function main() {
  const [, , slug] = process.argv;
  if (!slug) {
    console.error('Usage: node scripts/archive.js <slug>');
    process.exit(1);
  }
  const projectRoot = path.resolve(__dirname, '..');
  const configPath = path.join(projectRoot, 'configs', `${slug}.json`);
  if (!(await fs.pathExists(configPath))) {
    console.error('Config not found:', configPath);
    process.exit(1);
  }
  const historyDir = path.join(projectRoot, 'history', slug);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = path.join(historyDir, stamp);
  await fs.ensureDir(targetDir);
  await fs.copy(configPath, path.join(targetDir, `${slug}.json`));

  const config = await fs.readJson(configPath);
  const htmlFiles = [];
  if (config.raw_html_file) htmlFiles.push(config.raw_html_file);
  if (Array.isArray(config.sections)) {
    config.sections.forEach((section) => {
      if (section.html_file) htmlFiles.push(section.html_file);
    });
  }
  for (const fileRel of htmlFiles) {
    const src = path.join(projectRoot, fileRel);
    if (await fs.pathExists(src)) {
      const dest = path.join(targetDir, fileRel.replace(/[\\/]/g, '__'));
      await fs.copy(src, dest);
    }
  }
  console.log(`Archived ${slug} -> history/${slug}/${stamp}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
