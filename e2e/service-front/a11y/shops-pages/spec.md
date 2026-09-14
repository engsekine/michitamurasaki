# shops-pages（E2E 仕様）

## 目的

ダイビングショップ（033）の 4 画面（一覧・登録・詳細・編集）が WCAG 2.1 AA 違反なく表示されることと、一覧がモバイル幅でレイアウト崩れ（横スクロール）を起こさないことを守る。詳細・編集は seed に依存せず、テスト内で作成したショップでスキャンし後始末で削除する。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL:
  - `/shops`（一覧）
  - `/shops/new`（登録フォーム）
  - `/shops/[id]`（作成したショップの詳細）
  - `/shops/[id]/edit`（作成したショップの編集）
- 関連仕様: `specs/033-dive-shops/spec.md`（FR-001 登録、FR-003 一覧・詳細、FR-004 編集、FR-005 確認ダイアログを経た削除）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: シナリオ 2 でショップ 1 件（ショップ名 `a11y スキャン用ショップ_<Date.now()>`・電話番号 `0120-000-000`）を作成し、テスト末尾で削除する。シナリオ 1・3 は seed のみ
- その他: シナリオ 3 は viewport を 375×667 に変更する

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | /shops・/shops/new - WCAG 2.1 AA 違反なし | `/shops` と `/shops/new` をそれぞれ開き、`expectNoViolations` で違反が無いことを検証する。 |
| 2 | /shops/[id]・/shops/[id]/edit - WCAG 2.1 AA 違反なし（作成 → スキャン → 削除） | `/shops/new` でショップ名・電話番号を入力して「登録する」を押し、`/shops/[uuid]` への遷移後にスキャン。続けて `<現在 URL>/edit` を開いてスキャン。後始末として詳細へ戻り「削除」（exact）→「削除する」で削除し、`/shops` に戻ることを待つ。 |
| 3 | モバイル幅（375px）で /shops に横スクロールが発生しない | viewport を 375×667 にして `/shops` を開き `networkidle` を待ち、`document.documentElement.scrollWidth <= window.innerWidth` が `true` であることを検証する。 |

## 備考

- 詳細・編集の URL はショップ作成後の `page.url()` から取得し、`/edit` の付与・除去で相互に遷移する（seed 非依存）。
- ショップ名は `Date.now()` を付けて実行ごとに一意にする。
