# LaunchKit (ローンチキット)

セミナー／特典誘導系LPをテンプレ化し、設定ファイルから静的HTMLを生成する最小構成です。オプトインLP用のテンプレートはこの構成をベースに追加入れ替えできます。

## ディレクトリ構成

- `seminar/assets/` … 元LPのCSS・JS・画像など共通アセット（Opt-in用テーマCSSもここに配置）
- `templates/seminar/index.njk` … セミナー／特典誘導LP用テンプレート
- `templates/optin/base.njk` … Claudeなどの生HTMLを差し込むシンプルなOpt-inテンプレート
- `content/seminar/sample/` … 長文ブロックなど差し替えテキストを格納
- `content/optin/` … Claude出力などの生HTMLスニペットを格納
- `configs/*.json` … 案件ごとの設定ファイル（`seminar-sample.json`, `optin-sample.json`, `optin-enhanced.json` など）
- `scripts/build.js` … テンプレートと設定を合成して `dist/` に書き出すスクリプト（生HTMLにも対応）
- `scripts/import-claude.js` … Claudeなどの出力HTMLをテーマ対応のマークアップへ整形するCLI
- `scripts/markdown-to-html.js` … Markdown原稿を静的HTMLへ変換するCLI
- `seminar/assets/js/optin.js` … Opt-inページ向けのカウントダウン／sticky CTA初期化スクリプト
- `dist/` … 生成結果（`npm run build:*` 実行時に再作成）

## 使い方

1. 依存パッケージをインストール（初回のみ）

   ```bash
   cd /Users/kudo/Downloads/LaunchKit
   npm install
   ```

2. サンプルをビルド

   ```bash
   npm run build:seminar
   npm run build:optin
   npm run build:optin:enhanced
   npm run build:webinar
   npm run build:consult
   npm run build:all
   ```

   `dist/seminar-sample/index.html`、`dist/optin-sample/index.html`、`dist/optin-enhanced/index.html`、`dist/webinar-sample/index.html`、`dist/consult-sample/index.html`（および各 `assets/`）が生成されます。ブラウザで `index.html` を開けばテンプレ確認が可能です。

3. 雛形を作成（例：Opt-in）

   ```bash
   npm run scaffold -- --type=optin --slug=new-campaign --title="新キャンペーン"
   ```

   `configs/new-campaign.json` と関連HTMLが生成されます。

4. 新しい案件用に `configs/*.json` と `content/*.html` をコピーして編集

   - `slug` … 出力先ディレクトリ名（`dist/<slug>/`）
   - `template` … 使用するテンプレートパス（`optin/base.njk` を指定すると生HTMLをそのまま差し込めます）
   - `paths.assets` … 出力HTMLから見たアセットへの相対パス（既定は `./assets`）
   - `tag_manager.head/body` … GTM や Meta Pixel のスニペットをそのまま配列で記述
   - `countdown.deadline` … `data-deadline` 属性に入るISO形式の期限（`2025-03-31T23:59:59+09:00` など）
   - `caution.image` や各セクションの `*.image` … `seminar/assets/` からの相対パス
   - `sections` … 表示する順にブロックを定義（後述）
   - `raw_html_file` … Claudeなどで生成したHTML断片を指定（テンプレートが `raw_html` を受け取る場合に使用）
   - `sticky_cta` … `{ "enabled": true, "label": "…", "text": "…", "url": "…" }` の形式で設定すると固定CTAを自動生成

   編集後に `npm run build:seminar -- configs/new.json` のようにパスを渡せば新LPを生成できます。

## Claudeからの原稿を取り込む

1. Claudeに対して、セクションごとに `data-block`（例：`hero`, `section`, `problem-list`, `results`, `highlight`, `gift-box`, `urgency`, `ps` など）と役割ごとに `data-role`（例：`lead`, `catch`, `cta-copy`, `gift-item`, `gift-title`, `gift-value`, `gift-total`, `primary-cta`, `secondary-cta`, `sticky-cta-label`, `sticky-cta-link`, `countdown-label`, `urgency-alert`, `ps-title` 等）を付けたHTMLを出力してもらう。
2. 生成されたHTMLを `content/optin/raw-*.html` などに保存。
3. 変換スクリプトでLaunchKit向けのマークアップへ整形。

   ```bash
   node scripts/import-claude.js content/optin/raw-sample.html content/optin/sample.html
   ```

スクリプトはデータ属性を解析し、`optin.css` に定義済みのクラス（`hero`, `section`, `problem-list`, `cta-button` など）を自動付与します。同時にインラインスタイルや `<style>` タグを削除するため、デザインはLaunchKit側のテーマに統一されます。

## Markdown原稿からHTMLを生成する

1. Markdownで原稿を作成し、`content/.../*.md` に保存。
2. 変換スクリプトでHTMLへ変換。

   ```bash
   node scripts/markdown-to-html.js content/optin/sample.md content/optin/from-markdown.html
   ```

3. 生成されたHTMLを `raw_html_file` に指定するか、`scripts/import-claude.js` の入力として利用（Markdown→HTML→テーマ変換の二段構えも可能）。

デフォルトでGFM（テーブルやチェックリスト等）の記法に対応しており、改行は`<br>`として扱われます。

## 管理サーバー（プレビュー＆編集 UI）

```bash
npm run start:admin
```

- http://localhost:3001/admin で設定ファイルの閲覧・編集、ビルド、プレビューが可能です。
- `/api/projects` 経由でテンプレ／設定の自動取得、`/preview/<slug>/index.html` でビルド済みファイルを参照します。

## 運用サポートスクリプト

- `npm run scaffold -- --type=optin --slug=new-campaign --title="タイトル"` … テンプレから設定・HTMLを複製
- `node scripts/archive.js <slug>` … 設定とHTMLを `history/<slug>/` にタイムスタンプ付きで保存
- `node scripts/set-deadline.js <slug> [days]` … カウントダウンの締切を現在時刻から指定日数後に更新
- `node scripts/add-analytics.js <slug> <gtm|fb>` … 設定ファイルに測定タグを追記
- `node scripts/deploy-static.js <slug>` … `dist/<slug>` を `deploy/<slug>` にコピー（ホスティングへアップロード）

## GitHub Pages デプロイ

- `.github/workflows/deploy.yml` で `main` ブランチへ push すると `npm run build:all` を実行し、`dist/` を GitHub Pages にデプロイします。
- ワークフローは手動実行（workflow_dispatch）にも対応しているので、任意のタイミングでビルド／公開が可能です。

## セクション定義の考え方

`sections` 配列は上から順に描画され、`type` に応じてテンプレ側のレンダリングが切り替わります。

- `image-gallery` … 画像を複数並べるブロック
  - `heading_image` … セクションタイトル画像
  - `wrapper_class` … 画像を囲む div のクラス（既存CSSを活かす）
  - `images` … `src` / `alt` / `class` を指定
- `list` … 箇条書きリスト
  - `items` はHTML文字列を許可（太字・装飾向け）
- `bonus` … 特典一覧＋CTAボタン。`button` を省けばボタンなしで表示
- `faq` … `items` に {question, answer} の配列を指定し、Q&Aを表示
- `testimonials` … `items` に {name, title, quote} の配列を指定し、実績/お客様の声を表示
- `cta` … シンプルなボタン表示のみ
- `html` … 自由入力ブロック
  - `html_file` にスニペットファイルを指定するとビルド時に読み込み、`wrap_text` など好みのラッパークラスをあてられます

必要に応じて `sections` に他タイプを増やす・既存タイプを複製するだけで別構成のLPにも対応できます。画像ベースのLPであれば `html` タイプを使って `<img>` 群をまとめて挿入する運用が簡単です。

## アセット差し替え

- `seminar/assets/images/` 配下に案件ごとの画像を追加し、JSON内の `src` を差し替えます。
- 別フォルダにアセットを置きたい場合は、設定ファイルに `"assets_source": "relative/path/to/assets"` を追加してください（プロジェクトルートからの相対パス）。

## 今後の拡張ポイント

- 認証・権限管理やチームでの承認フロー
- Markdown/HTML プレビュー付き WYSIWYG 編集やライブプレビューの強化
- Google スプレッドシート／Notion など外部データソースとの連携による原稿同期
- テンプレート／コンポーネントの管理画面化（バージョン管理・マーケットプレイス化）

オプトイン型のテンプレも同様の構造で追加可能です。必要な要素・想定セクションが固まったら `templates/optin/` とサンプル設定を作成します。
