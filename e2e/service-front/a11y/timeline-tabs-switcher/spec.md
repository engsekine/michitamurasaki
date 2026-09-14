# timeline-tabs-switcher（E2E 仕様）

## 目的

TOP の `TimelineTabsSwitcher` は初期タブ「タイムライン」以外のパネルが `hidden` 属性で隠れており、top-page / social-pages のスキャンでは「いいねしたログ」パネルが axe の解析対象外になる。本テストはタブを切り替えてパネルを visible にした状態でスキャンし、隠れたパネル内の WCAG 2.1 AA 違反を検出できるようにする。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/`（TOP。「いいねしたログ」タブを選択した状態）
- 関連仕様: `specs/027-log-likes/spec.md`（FR-008a ホーム上部のタブでいいね一覧をその場で切り替え表示・WAI-ARIA Tabs）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: seed のみ
- その他: なし

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | TimelineTabsSwitcher - 「いいねしたログ」タブ表示時 - WCAG 2.1 AA 違反なし（要認証） | `/` を開いて `networkidle` を待ち、tab「いいねしたログ」をクリックして `aria-selected="true"` になることを確認したうえで、`expectNoViolations` により WCAG 2.1 AA 違反が無いことを検証する。 |

## 備考

- 初期タブ「タイムライン」でのスキャンは top-page / social-pages が担うため、本テストは「いいねしたログ」タブのみを対象とする。
