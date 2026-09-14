# log-credits-page（E2E 仕様）

## 目的

ログ枠の購入ページは課金導線であり、決済から戻ったときの結果通知（成功 / キャンセル）を含めて誰でも操作・理解できる必要がある。購入カード・履歴・結果通知の各表示状態と、ログ作成導線上の残枠バッジが WCAG 2.1 AA 違反なしで表示されることを守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/settings/log-credits`、`/settings/log-credits?checkout=cancelled`、`/settings/log-credits?checkout=success`、`/dives`、`/dives/new`
- 関連仕様: `specs/026-log-monetization/spec.md`（FR-013 残枠数の常時表示、US2 ログパック購入）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: seed のみ
- その他: なし

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | /settings/log-credits - 購入カードと残枠を表示し WCAG 2.1 AA 違反なし（要認証） | 見出し「ログ枠の購入」「購入履歴」と「残りログ枠」、3 パック（お試し 10 枠 / おすすめ 30 枠 / たっぷり 100 枠）の見出しと「購入する」ボタン 3 件の表示を確認し axe を実行。続けて `?checkout=cancelled` で「購入はキャンセルされました。」、`?checkout=success` で「ご購入ありがとうございます」と「ログ作成に戻る」リンクが表示された状態でもそれぞれ違反がないことを確認する。 |
| 2 | ログ一覧・新規作成に残枠バッジが表示される（FR-013） | `/dives` と `/dives/new` の両方で「残りログ枠」が表示されることを確認し、`/dives/new` で axe を実行して違反がないことを確認する。 |

## 備考

- 購入完了・返金の実フローは Stripe CLI が必要なため E2E では扱わず、`specs/026-log-monetization` の quickstart 3・4 による手動検証に委ねる。本テストはクエリパラメータで結果通知の表示のみを検証する。
- `/dives/new` では `waitForHydration` でハイドレーション完了を待ってから残枠バッジの表示を確認する。
