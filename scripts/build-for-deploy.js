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

  // 3. seminar/assetsをdist/seminar/にコピー
  console.log('Copying seminar LP...');
  const seminarSrc = path.join(projectRoot, 'seminar', 'assets');
  const seminarDist = path.join(distDir, 'seminar');
  if (await fs.pathExists(seminarSrc)) {
    await fs.ensureDir(seminarDist);
    await fs.copy(seminarSrc, seminarDist);
  }

  // 3.5. seminar2/assetsをdist/seminar2/にコピー
  console.log('Copying seminar2 LP...');
  const seminar2Src = path.join(projectRoot, 'seminar2', 'assets');
  const seminar2Dist = path.join(distDir, 'seminar2');
  if (await fs.pathExists(seminar2Src)) {
    await fs.ensureDir(seminar2Dist);
    await fs.copy(seminar2Src, seminar2Dist);
  }

  // 4. LP一覧ページを生成
  console.log('Generating LP list page...');
  const dirs = (await fs.readdir(distDir, { withFileTypes: true }))
    .filter(d => d.isDirectory() && !['assets', 'list'].includes(d.name))
    .map(d => d.name)
    .sort();

  const listHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>公開LP一覧 - LaunchKit</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif; background: #f5f5f5; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 24px; color: #333; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #333; }
    .lp-list { display: flex; flex-direction: column; gap: 12px; }
    .lp-item { background: white; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s; }
    .lp-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .lp-name { font-size: 16px; font-weight: 500; color: #333; }
    .lp-link { color: #0066cc; text-decoration: none; font-size: 14px; padding: 8px 16px; border: 1px solid #0066cc; border-radius: 4px; transition: all 0.2s; }
    .lp-link:hover { background: #0066cc; color: white; }
    .count { color: #666; font-size: 14px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>公開LP一覧</h1>
    <p class="count">全${dirs.length}件</p>
    <div class="lp-list">
${dirs.map(name => `      <div class="lp-item">
        <span class="lp-name">${name}</span>
        <a href="/${name}/" class="lp-link" target="_blank">開く</a>
      </div>`).join('\n')}
    </div>
  </div>
</body>
</html>`;

  await fs.ensureDir(path.join(distDir, 'list'));
  await fs.writeFile(path.join(distDir, 'list', 'index.html'), listHtml);

  console.log('Build for deployment completed!');
  console.log('- Root (/) -> threads-lp-green (no FV images)');
  console.log('- /threads-lp-green-v2/ -> with FV images');
  console.log('- /threads-lp-v2/ -> with FV images');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
