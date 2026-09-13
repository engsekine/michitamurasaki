# Research: 忘れ物確認機能

**Date**: 2026-08-07 | **Plan**: [plan.md](./plan.md)

Technical Context に NEEDS CLARIFICATION はないが、設計上の分岐点を検討して確定する。

## Decision 1: 完了状態・確認状態の持たせ方

**Decision**: 既存テーブルへのカラム追加で表現する。

- `dive_plans.packing_completed_at timestamptz`（nullable。null = 未完了。値あり = 完了中 + 完了日時）
- `plan_packing_items.is_confirmed boolean not null default false`（忘れ物確認の 2 周目チェック状態）

**Rationale**:
- 完了状態は予定 1 件につき高々 1 つ（1:1）なので、専用テーブルは 3NF 上も不要。boolean + timestamptz を分けず `*_at` の nullable 1 カラムで「状態 + 日時」を同時に表せる（sql.md のタイムスタンプ規約に整合）
- 確認状態は持ち物項目 1 件につき 1 つ（1:1）なので `plan_packing_items` の属性が自然。項目の追加・削除に自動追従し、FR-008（完了後の項目追加は未確認で現れる）が default false だけで満たせる
- 既存 RLS（本人のみ）がそのまま適用され、新規ポリシー不要

**Alternatives considered**:
- 専用テーブル `packing_confirmations(plan_id, item_id, confirmed_at)`: 履歴を持てるが、spec は最新状態のみ要求。JOIN が増え、項目削除時の整合管理も増えるため却下
- `is_checked` の使い回し（完了時にリセットして 2 周目に流用）: 準備チェックの状態が失われ FR-005（解除で準備チェックは保持）に違反するため却下

## Decision 2: 完了解除時の確認状態リセットの実装位置

**Decision**: Server Action `uncompletePacking` 内で「`packing_completed_at = null` 更新 + 該当予定の全 `is_confirmed = false` 更新」を実行する（DB トリガーは使わない）。

**Rationale**:
- リセットは「解除」というユーザー操作にのみ紐づくビジネスルール（Clarifications Q1）で、DB 層の不変条件ではない。アプリ層に置く方が仕様変更に強く、テストも書きやすい
- 2 文の更新で整合が壊れても実害は「確認済み表示が残る」程度で、次の完了時に UI 上リセット表示となるため厳密なトランザクション性は不要（とはいえ順次実行で十分速い）

**Alternatives considered**:
- `packing_completed_at` の変更を監視する DB トリガー: 仕様がスキーマに埋もれて見えなくなる。この規模では過剰のため却下

## Decision 3: 表示切替の実装方式（置き換え表示）

**Decision**: 親（Server Component: 予定詳細ページ / `NextPlanCardView`）が `packingCompletedAt` を見て、未完了なら既存チェックリスト（+ 完了ボタン）、完了中なら新規 `ForgottenItemChecklist`（+ 解除ボタン）をレンダリングする。

**Rationale**:
- 状態による出し分けはデータを持つ Server Component 側の条件分岐が最小実装（Constitution II）。クライアント側のタブ切替等は不要
- `ForgottenItemChecklist` は確認トグル・解除操作を持つため Client Component とし、既存 `PackingChecklist` と同じ「トグル → Server Action → router.refresh()」パターンを踏襲する

**Alternatives considered**:
- 1 つのコンポーネントに両モードを実装: 準備チェックと確認チェックで操作・文言・空状態が異なり、条件分岐だらけになるため却下

## Decision 4: 完了ボタンのガード（FR-007 / FR-009）

**Decision**: UI とサーバーの二重ガードにする。

- UI: 持ち物 0 件 or 予定日が過去の場合は完了ボタン・確認操作を表示しない（表示判定は既存 `daysUntil` / `canMovePlanToLog` と同様に JST 今日基準）
- Server Actions: `completePacking` / `toggleConfirmItem` / `uncompletePacking` でも同条件を検証し、違反時はエラーを返す（UI をすり抜けた場合の防御）

**Rationale**: Server Action は公開エンドポイントであり、UI 側の非表示だけでは FR-007 / FR-009 を保証できない。既存 actions（`togglePackingItem` 等）も所有チェックをサーバー側で行っており、同じ方針に揃える。

**Alternatives considered**: UI ガードのみ（サーバー検証なし）→ 直接呼び出しで終了済み予定を完了できてしまうため却下。
