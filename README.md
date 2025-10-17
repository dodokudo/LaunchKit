# LaunchKit (ローンチキット)

セミナー／特典誘導系LPをテンプレ化し、設定ファイルから静的HTMLを生成する最小構成です。オプトインLP用のテンプレートはこの構成をベースに追加入れ替えできます。

## ディレクトリ構成

- `seminar/assets/` … 元LPのCSS・JS・画像など共通アセット
- `templates/seminar/index.njk` … Nunjucksベースのメインテンプレート
- `content/seminar/sample/` … 長文ブロックなど差し替えテキストを格納
- `configs/seminar-sample.json` … サンプル設定ファイル
- `scripts/build.js` … テンプレートと設定を合成して `dist/` に書き出すスクリプト
- `dist/` … 生成結果（`npm run build:seminar` 実行時に再作成）

## 使い方

1. 依存パッケージをインストール（初回のみ）

   ```bash
   cd /Users/kudo/Downloads/LaunchKit
   npm install
   ```

2. サンプルをビルド

   ```bash
   npm run build:seminar
   ```

   `dist/seminar-sample/index.html` と `dist/seminar-sample/assets/` が生成されます。ブラウザで `index.html` を開けばテンプレ確認が可能です。

3. 新しい案件用に `configs/*.json` と `content/*.html` をコピーして編集

   - `slug` … 出力先ディレクトリ名（`dist/<slug>/`）
   - `template` … 使用するテンプレートパス（将来的に `optin/index.njk` などを追加）
   - `paths.assets` … 出力HTMLから見たアセットへの相対パス（既定は `./assets`）
   - `tag_manager.head/body` … GTM や Meta Pixel のスニペットをそのまま配列で記述
   - `countdown.deadline` … `data-deadline` 属性に入るISO形式の期限（`2025-03-31T23:59:59+09:00` など）
   - `caution.image` や各セクションの `*.image` … `seminar/assets/` からの相対パス
   - `sections` … 表示する順にブロックを定義（後述）

   編集後に `npm run build:seminar -- configs/new.json` のようにパスを渡せば新LPを生成できます。

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

オプトイン型のテンプレも同様の構造で追加可能です。必要な要素・想定セクションが固まったら `templates/optin/` とサンプル設定を作成します。
