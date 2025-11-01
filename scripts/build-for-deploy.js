#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const projectRoot = process.cwd();
  const distDir = path.join(projectRoot, 'dist');

  // 1. 全てをビルド
  console.log('Building all landing pages...');
  execSync('npm run build:all', { stdio: 'inherit', cwd: projectRoot });

  // 2. threads-lp-greenの内容をルートにコピー
  console.log('Copying threads-lp-green to root...');
  const greenDir = path.join(distDir, 'threads-lp-green');

  // index.htmlをルートにコピー
  await fs.copy(
    path.join(greenDir, 'index.html'),
    path.join(distDir, 'index.html')
  );

  // assetsをルートにコピー
  await fs.copy(
    path.join(greenDir, 'assets'),
    path.join(distDir, 'assets')
  );

  console.log('Build for deployment completed!');
  console.log('- Root (/) -> threads-lp-green (no FV images)');
  console.log('- /threads-lp-green-v2/ -> with FV images');
  console.log('- /threads-lp-v2/ -> with FV images');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
