# notification-bell-panel（E2E 仕様）

## 目的

ヘッダーの通知ベルから開く Sheet（`role="dialog"`）は、ベル閉状態のページスキャン（top-page / dashboard-page）では DOM に展開されず axe の解析対象外になる。本テストは Sheet を明示的に開いた状態で axe スキャンを行い、通知パネル内の WCAG 2.1 AA 違反を検出できるようにする。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/`（TOP。ヘッダーの通知ベルボタンから Sheet を開いた状態）
- 関連仕様: `specs/025-notifications/spec.md`（FR-004 ヘッダー通知アイコン → シート表示）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: seed のみ（seed に通知データが無い場合は「通知はありません」の空状態でスキャンされる）
- その他: なし

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | NotificationBellPanel - Sheet 開状態 - WCAG 2.1 AA 違反なし（要認証） | `/` を開いて `networkidle` を待ち、名前に「通知」を含むボタンをクリックして Sheet を開く。dialog 内の見出し「通知」とリンク「すべての通知を見る」が表示され、`[data-slot="sheet-content"]` の `opacity` が `1` になるのを待ってから `expectNoViolations` で WCAG 2.1 AA 違反が無いことを検証する。 |

## 備考

- Sheet の開きアニメーション（opacity 遷移）が終わる前に axe が走ると、半透明のコンテンツ越しにオーバーレイが透けた色でコントラストを誤検知するため、`opacity: 1` への収束を待ってからスキャンする。
- Sheet を開いた状態で axe スキャンする前例は `header-mobile-nav` を参照。
