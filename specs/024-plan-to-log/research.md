# Research: ダイビング予定をログへ移動

Phase 0 の設計判断を集約する。spec の Clarifications（2026-07-01）で確定済みの方針（移動＝予定削除 / 当日以前のみ / 部分失敗はログ保持+通知）を前提に、実装上の選択を記録する。

## Decision 1: 移動オーケストレーションは Server Action `createDiveFromPlan` に集約する

- **Decision**: クライアントで `createDive` → `deletePlan` を順に呼ぶのではなく、Server Action 1 本 `createDiveFromPlan(planId, input)` に (a) 予定の存在・所有確認 → (b) `createDive(input)` 再利用でログ作成 → (c) 成功時のみ `dive_plans` 削除、を閉じ込める。配置は dives feature（`features/dives/server/actions.ts`）。
- **Rationale**:
  - FR-015（対象予定が既に無い場合はログを重複作成せず通知）を満たすには、**ログ作成の前**に予定の存在を確認する必要がある。クライアント連続呼び出しでは createDive が先に走り、重複ログが生まれてしまう。
  - ログ側の Action に置くことで、同一モジュールの `createDive` をそのまま再利用でき、写真・バディ同期などの既存ロジックを重複させずに済む。
  - 削除対象は `dive_plans` テーブルのみで、plans feature の Action を import しないため feature 間結合を最小化できる（RLS が本人限定を担保）。
- **Alternatives considered**:
  - *クライアント連続呼び出し（createDive→deletePlan）*: 実装は最小だが、FR-015 の重複防止を満たせず、失敗時の分岐がクライアントに散らばる。却下。
  - *plans feature に move Action を置き createDive を import*: 「移動」を予定中心の操作と見れば自然だが、createDive の再利用で plans→dives の import が生じ、成果物（ログ）の生成責務がログ feature 外へ出る。dives 側集約の方が凝集度が高い。却下。
  - *DB トランザクション/RPC で原子化*: 厳密だが、写真アップロード等を含むログ作成全体を 1 トランザクションに収めるのは非現実的で、clarify で「非原子・ログ優先」を選択済み。過剰。却下。

## Decision 2: 移動導線のゲートは `daysUntil(plannedOn, todayInJst()) <= 0`

- **Decision**: 「ログに記録する」導線は当日（`daysUntil === 0`）および過去（`< 0`）の予定にのみ表示し、未来（`> 0`）は非表示にする。判定は plans feature の pure helper `canMovePlanToLog(plannedOn, today)` に切り出し、一覧（`PlanList`）と詳細（`/plans/[id]/page.tsx`）で共有する。
- **Rationale**:
  - ログの潜水日は未来日を受け付けない（`dive.schema` の実装で確認済み）。未来日予定を移動させると必ず保存エラーになるため、導線段階で防ぐ（FR-002 / SC-005）。
  - 既存 `PlanList` が「これから（`daysUntil >= 0`）/ 終了済み（`< 0`）」の区分に同じ `daysUntil` を使っており、関数を再利用すれば表示区分と移動可否の判定基準が一貫する。
  - 「今日」の予定は潜り終えた直後に記録するケースが典型のため移動可（`<= 0` に含める）。
- **Alternatives considered**:
  - *未来日も導線を出し、保存時にエラー表示*: ユーザーが無駄な入力後にエラーへ突き当たる。UX 劣化のため却下（clarify で「当日以降のみ許可」を選択済み）。
  - *クライアントで現在時刻から判定*: SSR とズレ・タイムゾーン差異のリスク。既存同様サーバーで `todayInJst()` を基準にする。

## Decision 3: プレフィルのマッピングと初期値

- **Decision**: pure mapper `planToDiveDefaults(plan)` を dives feature に新設し、`Partial<DiveFormValues>` を返す。

  | 予定（dive_plans） | ログ（DiveFormValues） | 備考 |
  |---|---|---|
  | `plannedOn` | `diveDate` | 当日以前に限定済みのため潜水日制約を満たす |
  | `location` | `location` | 自由入力として引き継ぐ。`diveSiteId` は空（マスタ排他を満たす） |
  | `notes` | `notes` | そのまま引き継ぐ |

  `diveNumber` は既存 new ページの自動採番（最新+1）を維持し、mapper とマージする。最大水深・潜水時間などログ必須項目は空のままユーザー入力（FR-006）。
- **Rationale**:
  - `location` 上限は予定・ログとも 120 文字、`notes` は両者 2000 文字で一致するため、引き継ぎで切り詰めは発生しない（FR-008 は防御的要件として契約に残すが実挙動では非発生）。
  - `diveSiteId` を空にし `location`（自由入力）だけを渡すことで、`dive.schema` の「location と diveSiteId は排他」ルールを満たす。ポイントマスタ（011）への自動マッチングは行わない（Assumption）。
  - `diveNumber` の自動採番を維持することで、移動で作られたログも通常の新規作成ログと同一に扱える（FR-013）。
- **Alternatives considered**:
  - *予定のポイント名をマスタ照合して `diveSiteId` に変換*: 表記ゆれで誤マッチのリスク。自由入力のまま引き継ぐ方が安全。却下。

## Decision 4: 部分失敗（ログ作成後の予定削除失敗）はログ保持 + 警告

- **Decision**: `createDiveFromPlan` はログ作成成功後に予定削除を試み、削除に失敗しても `actionSuccess({ id, planDeleteFailed: true })` を返す（ログは巻き戻さない）。`useDiveFormSubmit` は `planDeleteFailed` を検知して既存の `serverWarning` 経路で「ログは作成されましたが予定の削除に失敗しました。予定一覧から手動で削除してください」を通知し、作成ログ詳細への遷移は行う。
- **Rationale**:
  - clarify で「ログを残し、削除失敗を通知」を選択済み（記録を真実として保持、予定は残るので手動削除可能）。
  - 既存 `useDiveFormSubmit` は `buddyWarning` を同じ `serverWarning` state で扱っており、パターンを踏襲できる（新規 UI 概念を増やさない）。
- **Alternatives considered**:
  - *ログもロールバック*: 写真アップロード等を含む取り消しは複雑で失敗しうる。却下。
  - *通知せず完了扱い*: 予定が残った理由がユーザーに伝わらず混乱。却下。

## Decision 5: DB スキーマ変更は不要

- **Decision**: マイグレーションを追加しない。移動は既存 `dives` への insert と `dive_plans` の delete の合成で完結する。
- **Rationale**:
  - 「移動」は物理削除方針（状態カラムや移動履歴を持たない）。持ち物（`plan_packing_items`）は既存 FK の `on delete cascade` で連動削除される（FR-011）。
  - 既存 RLS（`dives`: 本人 insert / `dive_plans`: 本人 select・delete）が新たな操作をそのままカバーする。
- **Alternatives considered**:
  - *`dives.source_plan_id` を追加して由来を保持*: 予定は移動時に消えるため FK 先が消失し無意味。トレーサビリティ要件も spec に無い。却下。
