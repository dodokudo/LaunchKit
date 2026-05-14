# LaunchKit Tracking 運用ガイド

新規LPでLP閲覧数とLINE CTAクリック数をAutoStudioで計測するための設定。

## 仕組み

```
[新規LP: lkit.jp/opt-5]
   ↓ ページロード時 page_view送信
[LaunchKit共通JS (launchkit-tracking.js)]
   ↓ POST https://autostudio-self.vercel.app/api/launchkit/events
[AutoStudio BigQuery launchkit_events]

[LINE CTAボタンクリック]
   ↓ keepalive で line_cta_click 送信
   ↓ Lステップ直リンクへ遷移
```

## 既存LPは触らない

`configs/*.json` に `launchkit.lp_id` を入れない限り、テンプレからは一切scriptが出力されない。
既存LP（opt-3, seminar2, threads-* など）は無変更で動作継続する。

## 新規LP作成手順

### 1. AutoStudio側でLP登録

1. AutoStudio管理画面 `/launchkit` を開く
2. 「+ 新規LP登録」をクリック
3. 入力:
   - LP名（例: オプトLP v5）
   - slug（例: opt-5）
   - 公開URL（例: https://lkit.jp/opt-5）
   - ジャンル（オプト / セミナー / 個別相談 / その他）
   - 流入元（Threads / Instagram / Meta広告 / note / YouTube / その他）
   - LINE CTA URL（Lステップ直リンク、例: https://liff.line.me/xxx）
4. 登録 → 編集画面で表示されるUUIDを控える

### 2. LaunchKit configs/*.json に追加

新規LP用configファイルに以下を追加:

```json
{
  "launchkit": {
    "lp_id": "ここにAutoStudioで取得したUUID",
    "api_base": "https://autostudio-self.vercel.app"
  }
}
```

※ `api_base` は省略可（デフォルトでautostudio-self.vercel.appが使われる）

### 3. CTAボタンに data属性追加

新規LPのCTAボタン（LINE登録ボタン）に `data-launchkit-line-cta` 属性を付ける:

```html
<a href="https://liff.line.me/2005642913-XXXXX" data-launchkit-line-cta>
  LINE登録はこちら
</a>
```

短縮URL（autostudio-self.vercel.app/l/XXX）は使わず、直リンクでOK。
JSが自動で `line_cta_click` イベントを送ってからLINE遷移する。

### 4. ビルド & デプロイ

```bash
npm run build:all  # または該当LPのビルドコマンド
git add . && git commit -m "feat: add opt-5"
git push  # Vercel自動デプロイ
```

### 5. 動作確認

1. ブラウザDevTools開いた状態で `https://lkit.jp/{slug}` アクセス
2. Networkタブで `POST /api/launchkit/events` が成功（status 200）
3. CTAボタンをクリック → `line_cta_click` のPOST + Lステップへ遷移
4. AutoStudio管理画面 `/launchkit` で閲覧数・CTAクリック数の集計確認

## 設計上の重要ルール

- **CV最優先**: CTAクリック時、API失敗・タイムアウト・CORSエラー等いずれの場合も**必ずLINEへ遷移する**。計測のためにCVを落とさない
- **既存テーブル不侵犯**: 既存 `short_links` / `click_logs` / 既存 `/l/:code` リダイレクトには一切触らない。新規テーブル `launchkit_lps` / `launchkit_events` のみ使用
- **page_view抑制なし**: 毎ロード記録。多重送信防止は同一ロード内の重複呼び出し回避のみ
- **既存LP破壊禁止**: テンプレ編集は `{% if launchkit.lp_id %}` 条件分岐内のみ。既存configには launchkit.lp_id を入れないこと

## トラブルシュート

| 症状 | 確認ポイント |
|---|---|
| イベント送信されない | DevTools Console確認、`window.LAUNCHKIT_TRACKING` が設定されているか、JS読み込まれているか |
| CORSエラー | AutoStudio側 `/api/launchkit/events` のALLOWED_ORIGINS にドメイン追加 |
| CTAクリックで遷移しない | data属性タイポ確認、JSコンソールエラー確認 |
| BQに記録されない | AutoStudio管理画面でlpIdが有効か、is_active=trueか確認 |
