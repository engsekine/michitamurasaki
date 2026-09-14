# packing-completion（E2E 仕様）

## 目的

忘れ物確認機能は「準備完了 → 忘れ物確認リスト（2 周目チェック）→ 解除で準備チェックへ戻る」という状態遷移が本体で、Server Action と `router.refresh()` の往復で状態が保存・復元される。準備チェックの保持、確認状態のリセット、再読み込み後の保持といった仕様上の細かい約束を、実ブラウザで一連のフローとして守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/plans/new`（予定作成）、`/plans/{id}`（予定詳細・持ち物リスト / 忘れ物確認リスト）、`/plans`（一覧カード）
- 関連仕様: `specs/037-forgotten-item-check/spec.md`（FR-002 未チェック残でも完了可、FR-003 忘れ物確認リスト、FR-004 完了状態の保持、FR-005 解除時の準備チェック保持と確認状態の破棄、FR-006 確認状態の保存、Clarifications Q1。quickstart S1〜S3）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: テスト内で予定日 `2030-01-15`・ポイント名「037 忘れ物確認の検証」の予定を作成し、末尾で削除する。開始前にも同名の予定を `deletePlansByLocation` で全削除し、失敗残骸から自己回復する。持ち物リストの既定項目（「マスク」を含む）が予定作成時に付与されることに依存
- その他: `test.describe.configure({ mode: 'serial' })` で直列実行。テスト内で `test.slow()`（標準の 3 倍のタイムアウト）。予定作成は `waitForHydration` 後に入力し、送信前に入力値が保持されていることを確認する

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | S1〜S3: 準備完了 → 忘れ物確認 → 解除の一連フロー | **S1**: 予定を作成し「マスク」のみチェックした状態で「準備完了にする」→ 見出し「忘れ物確認リスト」、「/ N 確認済み」、progressbar「忘れ物確認の進捗」の `aria-valuenow=0` を assert。`reload` 後も忘れ物確認リストのまま。`/plans` のカード（region）に見出し「忘れ物確認」が出て「予定の詳細」から戻れる。**S2**: 「マスク」を確認すると `aria-valuenow=1`、`reload` 後もチェック済み。残り全件を確認すると status に「忘れ物なし」。**S3**: 「完了を解除」で見出し「持ち物リスト」に戻り、準備チェック（マスク）は保持されている。再度「準備完了にする」と確認状態はリセットされ `aria-valuenow=0` から始まる。最後に予定を削除する。 |

## 備考

- チェックは Server Action → `router.refresh()` 反映のため `check()` ではなく `click()` + 状態待ち（`toBeChecked`）を使う。直前の Server Action 反映中は checkbox が disabled になるため `toBeEnabled` を待ってから押す
- 並列実行中は dev サーバーのオンデマンドコンパイルで往復が 5 秒を超えることがあるため、全件確認ループの `toBeChecked` は timeout 15 秒、テスト全体は `test.slow()`
- `/plans` のカードは `aria-labelledby` 付き `section` のため `getByRole('region', { name: location })` で特定する
- 後始末ヘルパー `deletePlansByLocation` は「これからの予定」カード（「予定の詳細」リンク）と「終了済み」カード（カード全体が 1 リンク）の両方に対応し、同名が複数残っていても全件削除する（`plan-to-log-flows` と同型）
- ガード（FR-007 持ち物 0 件、FR-009 終了済み予定）の網羅は Server Action の Vitest で担保し、ここでは扱わない
