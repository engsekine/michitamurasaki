# Quickstart: ダイビング予定をログへ移動

本フィーチャーが端から端まで機能することを確認するための検証ガイド。実装詳細は [contracts/](contracts/) と [data-model.md](data-model.md) を参照。

## 前提

- service-front の開発サーバーが起動していること（`pnpm --filter service-front dev` 等、既存手順に従う）。
- ログイン済みのテストユーザーがいること。
- テスト用に「予定日が今日以前の予定」と「未来日の予定」をそれぞれ 1 件以上用意する（`/plans/new` から作成。未来日/過去日を入力）。

## 検証シナリオ

### S1: 当日以前の予定をログへ移動できる（US1 / FR-001,004〜013）

1. `/plans` を開く。
2. 予定日が今日または過去の予定カードに「ログに記録する」が表示されることを確認。
3. これを押す → `/dives/new?fromPlanId=<id>` に遷移し、フォームの**潜水日・ポイント名・メモ**が予定の内容で埋まっていることを確認。
4. 最大水深・潜水時間（必須）を入力して保存。
5. **期待**: 作成されたログの詳細 `/dives/<diveId>` に遷移。`/dives` 一覧に新規ログが 1 件増える。
6. `/plans` に戻り、移動元の予定が**消えている**ことを確認（持ち物リストも連動削除）。

### S2: 未来日の予定には移動導線が出ない（US2 / FR-002 / SC-005）

1. `/plans` を開く。
2. 未来日（「あと N 日」表示）の予定カードには「ログに記録する」が**表示されない**ことを確認。
3. 予定詳細 `/plans/<未来日の予定 id>` を開いても導線が出ないことを確認。

### S3: 必須未入力では移動が確定しない（FR-006 / FR-010）

1. 当日以前の予定から `/dives/new?fromPlanId=<id>` を開く。
2. 最大水深・潜水時間を空のまま保存を試みる。
3. **期待**: 該当フィールドにエラー。ログは作成されず、`/plans` の元予定も残っている。

### S4: 途中離脱では移動されない（FR-010 / AS-5）

1. 当日以前の予定から移動フォームを開く。
2. 保存せず `/plans` へ戻る。
3. **期待**: ログは作成されず、元の予定も残る。

### S5: 部分失敗（ログ作成成功・予定削除失敗）（FR-011a）

- **自動テスト**で検証する（手動再現は困難）。`createDiveFromPlan` の Vitest で、`dive_plans` delete がエラーを返すケースをモックし:
  - 戻り値が `{ success: true, id, planDeleteFailed: true }` であること（ログは作成済み）。
  - `useDiveFormSubmit` が `planDeleteFailed` を受けて `serverWarning` を設定し、詳細へ遷移すること。

### S6: 既に移動済みの予定を再移動しようとした場合（FR-015）

- **自動テスト**で検証。`createDiveFromPlan` に存在しない `planId` を渡すと、ログを作成せず `{ success: false, error: 'この予定は既に移動済みか削除されています' }` を返すこと。

## 自動テスト（Test-First / 原則 III）

| 対象 | テスト種別 | 主な観点 |
|---|---|---|
| `canMovePlanToLog` | Vitest | 過去=true / 今日=true / 未来=false（JST 境界） |
| `planToDiveDefaults` | Vitest | plannedOn→diveDate / location→location / notes→notes / diveSiteId 未設定 |
| `createDiveFromPlan` | Vitest | 存在確認→作成→削除の順序、S5/S6 の分岐、未認証拒否、createDive 失敗時に予定を残す |
| `useDiveFormSubmit` | Vitest | fromPlanId 有無での呼び分け、planDeleteFailed→serverWarning、失敗時に遷移しない |
| `DiveForm`（fromPlanId 初期値） | Storybook + Vitest | 引き継ぎ値の表示・編集可能性 |
| `PlanList`（導線） | Storybook + Vitest | 当日以前に導線あり / 未来日に無し |
| 予定→ログ移動 E2E | Playwright + axe-core | S1・S2 の通し操作と a11y 検証 |

## 確認ポイントの要約

- 引き継ぎ 3 項目（潜水日・ポイント名・メモ）の再入力がゼロ（SC-001）。
- 移動成功でログ +1 / 予定 −1 が 1 対 1（SC-003）。
- 失敗時にログ二重作成も予定消失も起きない（SC-004）。
- 未来日予定は導線が出ず保存エラーに遭遇しない（SC-005）。
