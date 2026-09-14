# public-pages（E2E 仕様）

## 目的

service-front の公開ページ（未認証で到達できる静的ルート）すべてが WCAG 2.1 AA 違反なく表示されることを守る。対象 URL は `service-front/src/app/` を走査して自動列挙するため、公開ページを追加すると自動的にスキャン対象に含まれる（テストの追記漏れを防ぐ）。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `service-front/src/app/` から自動列挙した公開ページ（動的セグメント・`api/`・認証必須 route group を除く）。執筆時点の列挙結果:
  - `/`
  - `/login`
  - `/login/verify`
  - `/reset-password`
  - `/signup`
  - `/update-password`
  - `/contact`
  - `/contact/complete`
  - `/guide`
  - `/lp`
  - `/privacy-policy`
  - `/terms`
- 関連仕様: なし

## 前提

- 認証: 未認証（NO_AUTH）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: seed のみ
- その他: なし

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | `<path> - WCAG 2.1 AA 違反なし`（`discoverPages` が返す URL ごとに 1 テストを動的生成。例: `/login - WCAG 2.1 AA 違反なし`） | 対象 URL へ遷移して `networkidle` を待ち、`AxeBuilder` を `wcag2a` / `wcag2aa` / `wcag21a` / `wcag21aa` タグで実行し、`violations` が空配列であることを検証する。 |

## 備考

- 走査ロジック（`discoverPages`）:
  - `APP_DIR` = `e2e/service-front/a11y/public-pages/` から 4 階層上（リポジトリルート）経由の `service-front/src/app`
  - ディレクトリを再帰走査し、`page.tsx` / `page.ts` が存在するディレクトリを 1 URL とする（ルート直下は `/`）
  - route group（`(xxx)`）は URL セグメントに含めない
  - 除外: `EXCLUDED_GROUPS` = `(authenticated)` / `(onboarding)`（認証必須。別ファイルで扱う）、`[` で始まる動的セグメント、`api` ディレクトリ
- `expectNoViolations` ではなく `AxeBuilder` を直接使っているが、タグは `shared/a11y.ts` の `WCAG_21_AA_TAGS` と同一。
- ファイル冒頭の `test.use({ storageState: NO_AUTH })` により、project 既定のログイン済み storageState を打ち消して未認証から始める。
