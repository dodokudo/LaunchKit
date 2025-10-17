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
   ```

   `dist/seminar-sample/index.html`、`dist/optin-sample/index.html`、`dist/optin-enhanced/index.html`（および各 `assets/`）が生成されます。ブラウザで `index.html` を開けばテンプレ確認が可能です。

3. 新しい案件用に `configs/*.json` と `content/*.html` をコピーして編集

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

## セクション定義の考え方

`sections` 配列は上から順に描画され、`type` に応じてテンプレ側のレンダリングが切り替わります。

- `image-gallery` … 画像を複数並べるブロック
  - `heading_image` … セクションタイトル画像
  - `wrapper_class` … 画像を囲む div のクラス（既存CSSを活かす）
  - `images` … `src` / `alt` / `class` を指定
- `list` … 箇条書きリスト
  - `items` はHTML文字列を許可（太字・装飾向け）
- `bonus` … 特典一覧＋CTAボタン。`button` を省けばボタンなしで表示
- `cta` … シンプルなボタン表示のみ
- `html` … 自由入力ブロック
  - `html_file` にスニペットファイルを指定するとビルド時に読み込み、`wrap_text` など好みのラッパークラスをあてられます

必要に応じて `sections` に他タイプを増やす・既存タイプを複製するだけで別構成のLPにも対応できます。画像ベースのLPであれば `html` タイプを使って `<img>` 群をまとめて挿入する運用が簡単です。

## アセット差し替え

- `seminar/assets/images/` 配下に案件ごとの画像を追加し、JSON内の `src` を差し替えます。
- 別フォルダにアセットを置きたい場合は、設定ファイルに `"assets_source": "relative/path/to/assets"` を追加してください（プロジェクトルートからの相対パス）。

## 今後の拡張ポイント

- `templates/optin/index.njk` を追加し、メールフォームやLINE友だち追加ボタン特化のテンプレを同じ仕組みで量産
- `sections` の`type`に `voice`（動画埋め込み）や `faq`（Q&Aリスト）などを拡充
- 設定ファイルをCSVやスプレッドシートから生成するスクリプトを追加し、非エンジニアでも更新できるフローを整備
- Claude出力を整形するCLI（`scripts/import-claude.js` など）を追加し、構造化→テーマ適用を自動化

オプトイン型のテンプレも同様の構造で追加可能です。必要な要素・想定セクションが固まったら `templates/optin/` とサンプル設定を作成します。
