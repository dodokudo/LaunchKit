#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// カテゴリを自動推測する関数
function guessCategory(slug) {
  if (slug.includes('sample')) return 'サンプル';
  if (slug.includes('consult') || slug.includes('consultation')) return '個別相談';
  if (slug.includes('seminar') || slug.includes('webinar')) return 'セミナー';
  return 'オプト'; // デフォルト
}

// 今日の日付を取得
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const projectRoot = process.cwd();
  const distDir = path.join(projectRoot, 'dist');
  const metaPath = path.join(projectRoot, 'configs', 'lp-meta.json');

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

  // メタ情報を読み込み
  let meta = {};
  if (await fs.pathExists(metaPath)) {
    meta = await fs.readJson(metaPath);
    delete meta._comment; // コメント行を除外
  }

  // distディレクトリのLP一覧を取得（サブディレクトリも含む）
  const dirs = [];
  const excludeDirs = ['assets', 'list', '.vercel', 'css', 'js', 'images', 'fonts'];
  const topDirs = (await fs.readdir(distDir, { withFileTypes: true }))
    .filter(d => d.isDirectory() && !excludeDirs.includes(d.name) && !d.name.startsWith('.'));

  for (const d of topDirs) {
    // サブディレクトリがあるかチェック（opt-3/ig, opt-3/th など）
    const subPath = path.join(distDir, d.name);
    const subDirs = (await fs.readdir(subPath, { withFileTypes: true }))
      .filter(sd => sd.isDirectory() && !excludeDirs.includes(sd.name) && !sd.name.startsWith('.'));

    if (subDirs.length > 0) {
      // サブディレクトリがある場合、それぞれを追加
      for (const sd of subDirs) {
        dirs.push(`${d.name}/${sd.name}`);
      }
      // 親ディレクトリにindex.htmlがあれば親も追加
      if (await fs.pathExists(path.join(subPath, 'index.html'))) {
        dirs.push(d.name);
      }
    } else {
      dirs.push(d.name);
    }
  }
  dirs.sort();

  // 新規LPがあればメタ情報に追加
  let metaUpdated = false;
  const today = getToday();
  for (const slug of dirs) {
    if (!meta[slug]) {
      meta[slug] = {
        name: slug,
        category: guessCategory(slug),
        created: today,
        updated: today
      };
      metaUpdated = true;
      console.log(`  New LP detected: ${slug} -> ${meta[slug].category}`);
    }
  }

  // メタ情報が更新されたら保存
  if (metaUpdated) {
    await fs.writeJson(metaPath, { _comment: 'カテゴリ: オプト / セミナー / 個別相談 / サンプル', ...meta }, { spaces: 2 });
    console.log('  lp-meta.json updated');
  }

  // カテゴリ一覧を取得
  const categories = [...new Set(Object.values(meta).map(m => m.category))].sort();

  // LP一覧データを生成
  const lpList = dirs.map(slug => {
    const m = meta[slug] || { name: slug, category: '未分類', created: '-', updated: '-' };
    return {
      slug,
      name: m.name,
      category: m.category,
      created: m.created,
      updated: m.updated
    };
  });

  const listHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>公開LP一覧 - LaunchKit</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif; background: #f5f5f5; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { font-size: 24px; color: #333; margin-bottom: 20px; }

    /* フィルターボタン */
    .filter-buttons { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid #333; }
    .filter-btn { padding: 8px 16px; border: 2px solid #333; background: white; border-radius: 20px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
    .filter-btn:hover { background: #f0f0f0; }
    .filter-btn.active { background: #333; color: white; }

    /* カウント */
    .count { color: #666; font-size: 14px; margin-bottom: 20px; }

    /* LP一覧 */
    .lp-list { display: flex; flex-direction: column; gap: 12px; }
    .lp-item { background: white; border-radius: 8px; padding: 16px 20px; display: grid; grid-template-columns: 1fr auto auto auto; gap: 16px; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s; }
    .lp-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .lp-item.hidden { display: none; }

    .lp-info { display: flex; flex-direction: column; gap: 4px; }
    .lp-name { font-size: 16px; font-weight: 500; color: #333; }
    .lp-slug { font-size: 12px; color: #999; font-family: monospace; }

    .lp-category { font-size: 12px; padding: 4px 10px; border-radius: 12px; background: #e8e8e8; color: #666; white-space: nowrap; }
    .lp-category[data-cat="オプト"] { background: #e3f2fd; color: #1976d2; }
    .lp-category[data-cat="セミナー"] { background: #fff3e0; color: #f57c00; }
    .lp-category[data-cat="個別相談"] { background: #f3e5f5; color: #7b1fa2; }
    .lp-category[data-cat="サンプル"] { background: #f5f5f5; color: #757575; }

    .lp-dates { font-size: 12px; color: #999; text-align: right; white-space: nowrap; }
    .lp-dates span { display: block; }

    .lp-link { color: #0066cc; text-decoration: none; font-size: 14px; padding: 8px 16px; border: 1px solid #0066cc; border-radius: 4px; transition: all 0.2s; white-space: nowrap; }
    .lp-link:hover { background: #0066cc; color: white; }

    @media (max-width: 700px) {
      .lp-item { grid-template-columns: 1fr; gap: 12px; }
      .lp-dates { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>公開LP一覧</h1>

    <div class="filter-buttons">
      <button class="filter-btn active" data-filter="all">すべて</button>
${categories.map(cat => `      <button class="filter-btn" data-filter="${cat}">${cat}</button>`).join('\n')}
    </div>

    <p class="count">全<span id="visible-count">${lpList.length}</span>件</p>

    <div class="lp-list">
${lpList.map(lp => `      <div class="lp-item" data-category="${lp.category}">
        <div class="lp-info">
          <span class="lp-name">${lp.name}</span>
          <span class="lp-slug">/${lp.slug}/</span>
        </div>
        <span class="lp-category" data-cat="${lp.category}">${lp.category}</span>
        <div class="lp-dates">
          <span>作成: ${lp.created}</span>
          <span>更新: ${lp.updated}</span>
        </div>
        <a href="/${lp.slug}/" class="lp-link" target="_blank">開く</a>
      </div>`).join('\n')}
    </div>
  </div>

  <script>
    const filterBtns = document.querySelectorAll('.filter-btn');
    const lpItems = document.querySelectorAll('.lp-item');
    const countEl = document.getElementById('visible-count');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // ボタンのアクティブ状態を切り替え
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        let visibleCount = 0;

        lpItems.forEach(item => {
          if (filter === 'all' || item.dataset.category === filter) {
            item.classList.remove('hidden');
            visibleCount++;
          } else {
            item.classList.add('hidden');
          }
        });

        countEl.textContent = visibleCount;
      });
    });
  </script>
</body>
</html>`;

  await fs.ensureDir(path.join(distDir, 'list'));
  await fs.writeFile(path.join(distDir, 'list', 'index.html'), listHtml);

  console.log('Build for deployment completed!');
  console.log('- Root (/) -> threads-lp-green (no FV images)');
  console.log('- /threads-lp-green-v2/ -> with FV images');
  console.log('- /threads-lp-v2/ -> with FV images');
  console.log(`- /list/ -> LP一覧 (${lpList.length}件)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
