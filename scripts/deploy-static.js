#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

async function main() {
  const [, , slug] = process.argv;
  if (!slug) {
    console.error('Usage: node scripts/deploy-static.js <slug>');
    process.exit(1);
  }
  const projectRoot = path.resolve(__dirname, '..');
  const sourceDir = path.join(projectRoot, 'dist', slug);
  if (!(await fs.pathExists(sourceDir))) {
    console.error('Build directory not found. Run build first.');
    process.exit(1);
  }
  const targetDir = path.join(projectRoot, 'deploy', slug);
  await fs.emptyDir(targetDir);
  await fs.copy(sourceDir, targetDir);
  console.log(`Copied dist/${slug} -> deploy/${slug}`);
  console.log('Upload deploy directory to your hosting service.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
