# CLAUDE.md — 選考進捗ボード（ra-senko-kanri）

RA業務専用の選考進捗管理アプリ。仕様の原文はユーザーの開発指示書（トップページ一覧性・カレンダー連携・入力のしやすさ最優先）。

## 構成
- ビルドなしの静的サイト（ES Modules）。`index.html` → `js/app.js`。ライブラリは `vendor/supabase.js`（supabase-js v2 UMD）のみ
- データは全て「レコード」`{id, kind, ...}`（kind: ca / candidate / company / application / event / status）。名前ではなくIDで参照するので改名は自動反映
  - application：応募1件（求職者×企業）。担当CAは candidate.caId（求職者単位）
  - event：type = interview / offer / followup / task。応募の日付（acceptDeadline, joinDate, nextActionDate）もカレンダーに出る
  - status：stage で集計区分（model.js STAGES）。初期IDは st_01〜st_19（demo.js が参照）
- 削除はソフト削除（deleted, deletedWith）→ 設定のゴミ箱から復元／完全削除（purged の印だけ残し他端末にも伝える）
- store.js（IndexedDB）に即保存 → cloud.js が Supabase `ra_records` に upsert。受信は Realtime + 60秒ポーリング + 画面復帰時
- アクセス制限は Supabase RLS（`ra_members` のメールのみ）。`supabase/setup.sql` が正。公開URL（localhost 以外）でクラウド未設定なら接続画面のみ表示

## 開発・確認
- `python serve.py`（8090番）。localhost ではクラウド未設定でも「この端末だけ」モードで動き、初回はダミーデータが入る
- ヘッドレスChromeは `--no-sandbox`、CDP接続は suppress_origin が必要。テストはスクラッチパッドに置き、削除コマンドは使わない（新しいフォルダに出力）
- 公開：GitHub Pages（repo tld315xrom927-lgtm/ra-senko-board, main ブランチ直下）。`git push` で反映
- 個人情報を扱うので、実データやバックアップJSON・CSVをリポジトリに入れない（.gitignore 済み）
