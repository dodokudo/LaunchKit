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

    /* コントロール */
    .controls { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #ddd; }
    .filter-buttons { display: flex; gap: 6px; flex-wrap: wrap; }
    .filter-btn { padding: 6px 14px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; }
    .filter-btn:hover { background: #f0f0f0; border-color: #999; }
    .filter-btn.active { background: #333; color: white; border-color: #333; }

    .sort-control { display: flex; align-items: center; gap: 8px; margin-left: auto; }
    .sort-control label { font-size: 13px; color: #666; }
    .sort-control select { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; background: white; }

    .action-buttons { display: flex; gap: 8px; }
    .action-btn { padding: 6px 12px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s; }
    .action-btn:hover { background: #f0f0f0; }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .action-btn.primary { border-color: #0066cc; color: #0066cc; }
    .action-btn.primary:hover:not(:disabled) { background: #0066cc; color: white; }

    /* カウント */
    .sub-controls { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .count { color: #666; font-size: 14px; }
    .edit-mode-toggle { font-size: 13px; color: #666; display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .edit-mode-toggle input { cursor: pointer; }

    /* LP一覧 */
    .lp-list { display: flex; flex-direction: column; gap: 12px; }
    .lp-item { background: white; border-radius: 8px; padding: 16px 20px; display: grid; grid-template-columns: auto 1fr auto auto auto; gap: 16px; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s; }
    .lp-checkbox { width: 18px; height: 18px; cursor: pointer; }
    .lp-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .lp-item.hidden { display: none; }

    .lp-info { display: flex; flex-direction: column; gap: 4px; }
    .lp-name { font-size: 16px; font-weight: 500; color: #333; }
    .lp-name-input { font-size: 16px; font-weight: 500; color: #333; border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px; width: 100%; display: none; }
    .lp-slug { font-size: 12px; color: #999; font-family: monospace; }

    .lp-category { font-size: 12px; padding: 4px 10px; border-radius: 12px; background: #e8e8e8; color: #666; white-space: nowrap; cursor: default; }
    .lp-category-select { font-size: 12px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd; display: none; }
    .lp-category[data-cat="オプト"] { background: #e3f2fd; color: #1976d2; }
    .lp-category[data-cat="セミナー"] { background: #fff3e0; color: #f57c00; }
    .lp-category[data-cat="個別相談"] { background: #f3e5f5; color: #7b1fa2; }
    .lp-category[data-cat="サンプル"] { background: #f5f5f5; color: #757575; }

    .lp-dates { font-size: 12px; color: #999; text-align: right; white-space: nowrap; }
    .lp-dates span { display: block; }

    .lp-link { color: #0066cc; text-decoration: none; font-size: 14px; padding: 8px 16px; border: 1px solid #0066cc; border-radius: 4px; transition: all 0.2s; white-space: nowrap; }
    .lp-link:hover { background: #0066cc; color: white; }

    /* 編集モード */
    body.edit-mode .lp-name { display: none; }
    body.edit-mode .lp-name-input { display: block; }
    body.edit-mode .lp-category { display: none; }
    body.edit-mode .lp-category-select { display: block; }
    body.edit-mode .lp-item { background: #fffef0; }

    .toast { position: fixed; bottom: 20px; right: 20px; background: #333; color: white; padding: 12px 20px; border-radius: 8px; font-size: 14px; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
    .toast.show { opacity: 1; }

    @media (max-width: 700px) {
      .lp-item { grid-template-columns: 1fr; gap: 12px; }
      .lp-dates { text-align: left; }
      .controls { flex-direction: column; align-items: stretch; }
      .sort-control { margin-left: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>公開LP一覧</h1>

    <div class="controls">
      <div class="filter-buttons">
        <button class="filter-btn active" data-filter="all">すべて</button>
${categories.map(cat => `        <button class="filter-btn" data-filter="${cat}">${cat}</button>`).join('\n')}
      </div>
      <div class="sort-control">
        <label>並び替え:</label>
        <select id="sort-select">
          <option value="created-desc" selected>作成日（新しい順）</option>
          <option value="created-asc">作成日（古い順）</option>
          <option value="updated-desc">更新日（新しい順）</option>
          <option value="updated-asc">更新日（古い順）</option>
          <option value="name">名前順</option>
        </select>
      </div>
      <div class="action-buttons">
        <button class="action-btn primary" id="export-btn" disabled>HTMLをダウンロード</button>
        <button class="action-btn" id="edit-done-btn" style="display:none;">編集終了</button>
      </div>
    </div>

    <div class="sub-controls">
      <p class="count">全<span id="visible-count">${lpList.length}</span>件 <span id="selected-count"></span></p>
      <label class="edit-mode-toggle">
        <input type="checkbox" id="edit-mode-checkbox">
        編集モード
      </label>
    </div>

    <div class="lp-list" id="lp-list">
${lpList.map(lp => `      <div class="lp-item" data-slug="${lp.slug}" data-category="${lp.category}" data-created="${lp.created}" data-updated="${lp.updated}" data-name="${lp.name}">
        <input type="checkbox" class="lp-checkbox">
        <div class="lp-info">
          <span class="lp-name">${lp.name}</span>
          <input type="text" class="lp-name-input" value="${lp.name}">
          <span class="lp-slug">/${lp.slug}/</span>
        </div>
        <span class="lp-category" data-cat="${lp.category}">${lp.category}</span>
        <select class="lp-category-select">
          <option value="オプト"${lp.category === 'オプト' ? ' selected' : ''}>オプト</option>
          <option value="セミナー"${lp.category === 'セミナー' ? ' selected' : ''}>セミナー</option>
          <option value="個別相談"${lp.category === '個別相談' ? ' selected' : ''}>個別相談</option>
          <option value="サンプル"${lp.category === 'サンプル' ? ' selected' : ''}>サンプル</option>
        </select>
        <div class="lp-dates">
          <span>作成: ${lp.created}</span>
          <span>更新: ${lp.updated}</span>
        </div>
        <a href="/${lp.slug}/" class="lp-link" target="_blank">開く</a>
      </div>`).join('\n')}
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const STORAGE_KEY = 'launchkit-lp-meta';
    const originalData = ${JSON.stringify(lpList)};
    let lpData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

    // ローカルストレージのデータを適用
    document.querySelectorAll('.lp-item').forEach(item => {
      const slug = item.dataset.slug;
      if (lpData[slug]) {
        if (lpData[slug].name) {
          item.dataset.name = lpData[slug].name;
          item.querySelector('.lp-name').textContent = lpData[slug].name;
          item.querySelector('.lp-name-input').value = lpData[slug].name;
        }
        if (lpData[slug].category) {
          item.dataset.category = lpData[slug].category;
          const catEl = item.querySelector('.lp-category');
          catEl.textContent = lpData[slug].category;
          catEl.dataset.cat = lpData[slug].category;
          item.querySelector('.lp-category-select').value = lpData[slug].category;
        }
      }
    });

    // フィルター
    const filterBtns = document.querySelectorAll('.filter-btn');
    const lpList = document.getElementById('lp-list');
    const countEl = document.getElementById('visible-count');
    let currentFilter = 'all';

    function applyFilter() {
      let visibleCount = 0;
      document.querySelectorAll('.lp-item').forEach(item => {
        if (currentFilter === 'all' || item.dataset.category === currentFilter) {
          item.classList.remove('hidden');
          visibleCount++;
        } else {
          item.classList.add('hidden');
        }
      });
      countEl.textContent = visibleCount;
    }

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        applyFilter();
      });
    });

    // ソート
    const sortSelect = document.getElementById('sort-select');
    sortSelect.addEventListener('change', () => {
      const items = Array.from(document.querySelectorAll('.lp-item'));
      const sortBy = sortSelect.value;

      items.sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.dataset.name.localeCompare(b.dataset.name, 'ja');
          case 'created-desc':
            return b.dataset.created.localeCompare(a.dataset.created);
          case 'created-asc':
            return a.dataset.created.localeCompare(b.dataset.created);
          case 'updated-desc':
            return b.dataset.updated.localeCompare(a.dataset.updated);
          case 'updated-asc':
            return a.dataset.updated.localeCompare(b.dataset.updated);
          default:
            return 0;
        }
      });

      items.forEach(item => lpList.appendChild(item));
    });

    // 編集モード
    const editModeCheckbox = document.getElementById('edit-mode-checkbox');
    const editDoneBtn = document.getElementById('edit-done-btn');

    function setEditMode(enabled) {
      document.body.classList.toggle('edit-mode', enabled);
      editModeCheckbox.checked = enabled;
      editDoneBtn.style.display = enabled ? 'inline-block' : 'none';
    }

    editModeCheckbox.addEventListener('change', () => {
      setEditMode(editModeCheckbox.checked);
    });

    editDoneBtn.addEventListener('click', () => {
      setEditMode(false);
      showToast('編集を終了しました');
    });

    // 名前変更
    document.querySelectorAll('.lp-name-input').forEach(input => {
      input.addEventListener('change', () => {
        const item = input.closest('.lp-item');
        const slug = item.dataset.slug;
        const newName = input.value.trim();

        item.dataset.name = newName;
        item.querySelector('.lp-name').textContent = newName;

        if (!lpData[slug]) lpData[slug] = {};
        lpData[slug].name = newName;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lpData));
        showToast('保存しました');
      });
    });

    // カテゴリ変更
    document.querySelectorAll('.lp-category-select').forEach(select => {
      select.addEventListener('change', () => {
        const item = select.closest('.lp-item');
        const slug = item.dataset.slug;
        const newCategory = select.value;

        item.dataset.category = newCategory;
        const catEl = item.querySelector('.lp-category');
        catEl.textContent = newCategory;
        catEl.dataset.cat = newCategory;

        if (!lpData[slug]) lpData[slug] = {};
        lpData[slug].category = newCategory;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lpData));
        showToast('保存しました');
        applyFilter();
      });
    });

    // チェックボックス
    const exportBtn = document.getElementById('export-btn');
    const selectedCountEl = document.getElementById('selected-count');

    function updateSelectedCount() {
      const checked = document.querySelectorAll('.lp-checkbox:checked').length;
      if (checked > 0) {
        selectedCountEl.textContent = '（' + checked + '件選択中）';
        exportBtn.disabled = false;
      } else {
        selectedCountEl.textContent = '';
        exportBtn.disabled = true;
      }
    }

    document.querySelectorAll('.lp-checkbox').forEach(cb => {
      cb.addEventListener('change', updateSelectedCount);
    });

    // HTMLエクスポート
    exportBtn.addEventListener('click', async () => {
      const checkedItems = document.querySelectorAll('.lp-item:has(.lp-checkbox:checked)');
      if (checkedItems.length === 0) return;

      exportBtn.disabled = true;
      exportBtn.textContent = 'ダウンロード中...';

      for (const item of checkedItems) {
        const slug = item.dataset.slug;
        const name = item.dataset.name;
        try {
          const res = await fetch('/' + slug + '/');
          const html = await res.text();
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = slug.replace(/\\//g, '-') + '.html';
          a.click();
          URL.revokeObjectURL(url);
          await new Promise(r => setTimeout(r, 300));
        } catch (e) {
          console.error('Failed to download:', slug, e);
        }
      }

      exportBtn.disabled = false;
      exportBtn.textContent = 'HTMLをダウンロード';
      showToast(checkedItems.length + '件ダウンロードしました');
    });

    // 初期ソート（作成日 新しい順）
    (function initialSort() {
      const items = Array.from(document.querySelectorAll('.lp-item'));
      items.sort((a, b) => b.dataset.created.localeCompare(a.dataset.created));
      items.forEach(item => lpList.appendChild(item));
    })();

    // トースト
    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
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
