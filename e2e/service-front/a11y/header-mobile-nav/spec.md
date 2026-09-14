# header-mobile-nav（E2E 仕様）

## 目的

SP 用ハンバーガーメニュー（HeaderMobileNav）はデスクトップビューポートでは `md:hidden` で display:none になり、通常の a11y スキャンでは axe の解析対象から外れて検証漏れになる。モバイルビューポートを明示し、メニュー閉・開（未認証 / 認証済み）の各状態で WCAG 2.1 AA 違反がないことを守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/login`（公開ページのヘッダー）、`/`（ログイン後ダッシュボードのヘッダー）
- 関連仕様: なし

## 前提

- 認証: 未認証（NO_AUTH）。シナリオ 3 のみテスト内で SERVICE_USER（test@example.com）にログイン
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: seed のみ
- その他: 全シナリオで viewport を 375×812（md ブレークポイント 768px 未満）に変更。playwright.config.ts の project は Desktop Chrome のみのため、テスト内で切り替える

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | HeaderMobileNav - トリガー表示状態（メニュー閉） - WCAG 2.1 AA 違反なし | モバイル幅で `/login` を開き、「メニューを開く」ボタン（exact）が表示された状態で axe を実行し違反がないことを確認する。 |
| 2 | HeaderMobileNav - Sheet 開状態（メニュー開） - WCAG 2.1 AA 違反なし | モバイル幅で `/login` を開き「メニューを開く」をクリック。`navigation`「メインナビゲーション」が表示され Sheet の opacity が 1 に収束した状態で axe を実行し違反がないことを確認する。 |
| 3 | HeaderMobileNav - 認証済みページでの Sheet 開状態 - WCAG 2.1 AA 違反なし | SERVICE_USER でログイン後、モバイル幅で `/` を開きメニューを開く。認証済み用のナビゲーション項目が表示された Sheet（opacity 1）で axe を実行し違反がないことを確認する。 |

## 備考

- 「メニューを開く」は `exact: true` で取得する。ヘッダー刷新で「ログイン/アカウントメニューを開く」ボタンが追加され、部分一致だと 2 件ヒットするため。
- Sheet を開いた直後に axe を走らせると開きアニメーション（opacity 遷移）中の半透明色でコントラスト違反を誤検知するため、`[data-slot="sheet-content"]` の opacity が `1` になるのを待ってからスキャンする。
- ページ遷移後は `networkidle` を待っている。
