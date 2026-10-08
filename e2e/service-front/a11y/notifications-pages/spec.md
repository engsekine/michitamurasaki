# notifications-pages（E2E 仕様）

## 目的

通知機能（025）の 2 画面（通知一覧・通知設定）が WCAG 2.1 AA 違反なく表示されることを守る。通知一覧はヘッダーの通知導線（ベルパネル → 「すべての通知を見る」）から実際に遷移して到達できることも合わせて確認する。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL:
  - `/`（ヘッダーの通知ベルパネルを開く起点）
  - `/notifications`（通知一覧）
  - `/settings/notifications`（通知設定）
- 関連仕様:
  - `specs/025-notifications/spec.md`（FR-004 ヘッダー通知アイコン → シート → 通知一覧への導線、FR-011 種別ごとの ON/OFF）
  - `specs/027-log-likes/spec.md`（通知種別 `log_liked` の追加）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: seed のみ
- その他: なし

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | 通知一覧 - WCAG 2.1 AA 違反なし（要認証 / 025） | `/` を開き、名前が「通知」で始まるボタンをクリックしてベルパネルを開き、リンク「すべての通知を見る」をクリックして `/notifications` へ遷移する。見出し「通知」（exact）が表示されることを確認し、`expectNoViolations` で違反が無いことを検証する。 |
| 2 | 通知設定 - WCAG 2.1 AA 違反なし（要認証 / 025） | `/settings/notifications` を開き、見出し「通知設定」が表示されることと、`role="switch"` が 5 個（025 FR-011 の 4 種別 + 027 の `log_liked`、`NOTIFICATION_TYPES` と同数）あることを確認し、`expectNoViolations` で違反が無いことを検証する。 |

## 備考

- ヘッダー刷新で通知アイコンは `/notifications` への直接リンクからベルパネル（Sheet）を開くボタンに変わったため、通知一覧へはパネル内の「すべての通知を見る」経由で遷移する。
- トグル数 5 は `NOTIFICATION_TYPES` の要素数に依存する。通知種別を追加・削除した場合はこの期待値も更新が必要。
