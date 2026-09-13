# Tasks: ダイビング申し込みシートのテキスト出力

**Input**: Design documents from `/specs/032-dive-application-form/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/application-sheet-page.md, quickstart.md

**Tests**: Constitution III（Test-First・テスト同梱）に従い、実装前にテストを書く。

**Organization**: ユーザーストーリー単位でフェーズ分割し、各ストーリーを独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（異なるファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2 / US3）
- パスはリポジトリルートからの相対パス

## Phase 1: Setup

**Purpose**: ワークツリー環境の検証（plan.md 前提の確認）

- [X] T001 ワークツリー `worktree-032-dive-application-form` のベースラインを検証する（develop 追従済みを確認 / node_modules が無ければメインリポジトリへの symlink で解決 / `npx biome check .` クリーン / `npx tsc --noEmit`（service-front）OK / Vitest unit プロジェクトがパスすること）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ストーリーが依存する DB スキーマ・型・定数・バリデーションスキーマ・feature 公開 API

**⚠️ CRITICAL**: このフェーズ完了までユーザーストーリーの実装に着手しない

- [X] T002 マイグレーション supabase/migrations/20260710120000_create_application_profiles.sql を作成する（data-model.md の通り: `application_profiles` テーブル + CHECK 制約 + `handle_updated_at` トリガ + RLS 有効化 + select/insert/update の本人ポリシー（`(select auth.uid())` 形式）+ comment on。作成後 `npx supabase db reset` で適用確認）
- [X] T003 [P] `SheetFormValues` / `SheetPrefill` / `RentalItemKey` 等の型を service-front/src/features/application-sheet/types.ts に作成する（contracts のサーバー契約・出力契約に対応。JSDoc コメント付き）
- [X] T004 [P] `PAGE_DATA`（slug `/application-sheet`・title「申し込みシート」・description）と `RENTAL_ITEMS`（品目 14 種のキー・ラベル。contracts の並び順）・有無 / コンタクト種類の選択肢定数を service-front/src/features/application-sheet/constants.ts に作成する
- [X] T005 yup スキーマを service-front/src/features/application-sheet/schemas/application-sheet.schema.ts に作成し、単体テストを同 schemas/application-sheet.schema.test.ts に書く（全項目任意 / 電話・足サイズ・本数の形式と範囲 / コンタクト「有」時のみ種類が意味を持つこと。T003・T004 依存）
- [X] T006 feature 公開 API を service-front/src/features/application-sheet/index.ts に作成する（型・定数・スキーマを再 export。コンポーネント・server は各ストーリー実装時に追記）

**Checkpoint**: スキーマ・型・定数が確定 — ユーザーストーリー実装を開始できる

---

## Phase 3: User Story 1 - 申し込みシートを作成してコピーする (Priority: P1) 🎯 MVP

**Goal**: `/application-sheet` でフォーム入力 → 定型テキスト生成（空欄・○・省略トグル対応）→ コピーまでを提供し、TOP ダッシュボードに導線を置く

**Independent Test**: ログイン済みユーザーが TOP の導線から画面を開き、項目を入力して契約通りのテキストをコピーできる（quickstart.md シナリオ 1・2）

### Tests for User Story 1（実装前に書き、FAIL を確認する）⚠️

- [X] T007 [P] [US1] `buildSheetText` の Vitest テストを service-front/src/features/application-sheet/lib/buildSheetText/buildSheetText.test.ts に作成する（contracts の出力テキスト契約を期待値とする: 全項目空欄の全文 / 全項目入力済みの全文 / 選択品目のみ ○ / レンタル「無」+ トグル OFF で空欄のまま全文 / トグル ON で品目〜サイズ欄ブロック省略 / 年月日・単位の整形。FR-004/005/012・SC-002）
- [X] T008 [P] [US1] `SheetPreview` の Vitest テストを service-front/src/features/application-sheet/components/client/SheetPreview/SheetPreview.test.tsx に作成する（readonly の textarea に全文が表示される / コピーボタン押下で `navigator.clipboard.writeText` が全文で呼ばれる / 成功時 `role="status"` の完了メッセージが出る / clipboard 不可時もテキストが選択可能なまま）
- [X] T009 [P] [US1] `RentalItemsField` の Vitest テストを service-front/src/features/application-sheet/components/client/RentalItemsField/RentalItemsField.test.tsx に作成する（有 / 無のラジオ / 「無」選択時は品目チェックボックスと省略トグルの表示制御（FR-011）/ 品目 14 種が RENTAL_ITEMS の並びで表示される）
- [X] T010 [P] [US1] `ApplicationSheetForm` の Vitest テストを service-front/src/features/application-sheet/components/client/ApplicationSheetForm/ApplicationSheetForm.test.tsx に作成する（全入力項目が label 関連付けで存在する / 入力がプレビューに反映される / バリデーションエラーが `role="alert"` + `aria-invalid` で表示される）

### Implementation for User Story 1

- [X] T011 [US1] `buildSheetText` を service-front/src/features/application-sheet/lib/buildSheetText/buildSheetText.ts + index.ts に実装する（純関数。T007 がパスすること）
- [X] T012 [US1] `SheetPreview` を service-front/src/features/application-sheet/components/client/SheetPreview/SheetPreview.tsx + index.ts に実装する（T008 がパスすること）+ SheetPreview.stories.tsx を同フォルダに作成する
- [X] T013 [US1] `RentalItemsField` を service-front/src/features/application-sheet/components/client/RentalItemsField/RentalItemsField.tsx + index.ts に実装する（`Controller` 経由で受け取り RHF オブジェクトは Props にしない。T009 がパスすること）+ RentalItemsField.stories.tsx を同フォルダに作成する
- [X] T014 [US1] `ApplicationSheetForm` を service-front/src/features/application-sheet/components/client/ApplicationSheetForm/ApplicationSheetForm.tsx + index.ts に実装し、features/application-sheet/index.ts に export を追記する（`'use client'`・RHF + yup・`buildSheetText` でプレビュー生成。prefill / 保存は後続ストーリーで接続。T010 がパスすること）+ ApplicationSheetForm.stories.tsx を同フォルダに作成する
- [X] T015 [US1] ルートページを service-front/src/app/(authenticated)/application-sheet/page.tsx に作成する（Server Component・`generatePageMetadata(PAGE_DATA, { noIndex: true })`・h1 + `ApplicationSheetForm` を描画。この時点では prefill なしで空の初期値を渡す）
- [X] T016 [P] [US1] service-front/src/proxy.ts の `APP_ROUTE_PREFIXES` に `/application-sheet` を追加する（未認証アクセスが /login へリダイレクトされることを quickstart で確認）
- [X] T017 [P] [US1] TOP ダッシュボード（service-front/src/app/page.tsx）に申し込みシートへの導線セクションを追加する（既存セクションと同じ pt-20 の余白規約・`GuideIntroSection` の直前に配置。見出し + 説明 + 「申し込みシートを作る」→ `/application-sheet`）

**Checkpoint**: US1 単体で入力 → 生成 → コピーが完結（MVP）

---

## Phase 4: User Story 2 - 登録済みデータからの自動入力 (Priority: P2)

**Goal**: プロフィール・保有資格・ダイブログから該当項目を自動入力し、上書き修正可能にする

**Independent Test**: データ登録済みユーザーで画面を開くと該当項目が自動入力され、未登録ユーザーでは空欄でエラーにならない（quickstart.md シナリオ 3）

### Tests for User Story 2（実装前に書き、FAIL を確認する）⚠️

- [X] T018 [P] [US2] `getApplicationSheetPrefill` の Vitest テストを service-front/src/features/application-sheet/server/queries.test.ts に作成する（user_details / certifications（取得日降順の先頭 rank）/ dives（count・max(dive_date) → 「YYYY年M月」）のマッピング / 各ソース未登録時に null を返す（FR-009）/ gender `unanswered` は空欄扱い。Supabase クライアントはモック）

### Implementation for User Story 2

- [X] T019 [US2] `getApplicationSheetPrefill` を service-front/src/features/application-sheet/server/queries.ts に実装する（research.md Decision 1 のマッピング表・並列取得。年齢算出は `@/shared/lib/date` を利用。T018 がパスすること）
- [X] T020 [US2] page.tsx（service-front/src/app/(authenticated)/application-sheet/page.tsx）で prefill を取得して `ApplicationSheetForm` に渡し、フォームの defaultValues に反映する（自動入力値は上書き可能（FR-008）。ApplicationSheetForm.test.tsx に prefill 反映・上書きのテストを追加してから実装する）

**Checkpoint**: 登録済みユーザーは手入力が半分以下で済む（SC-003）

---

## Phase 5: User Story 3 - 入力内容の保存と再利用 (Priority: P3)

**Goal**: 「保存」ボタンで個人属性を application_profiles に upsert し、次回訪問時に復元する

**Independent Test**: 入力 → 保存 → 再訪問で前回値が復元され、レンタル選択・トグルは復元されない（quickstart.md シナリオ 4)

### Tests for User Story 3（実装前に書き、FAIL を確認する）⚠️

- [X] T021 [P] [US3] `saveApplicationProfile` の Vitest テストを service-front/src/features/application-sheet/server/actions.test.ts に作成する（yup 再バリデーション / 本人 user_id で upsert される / 不正入力はエラーを返す / 個人情報の値をログ出力しない。Supabase クライアントはモック）

### Implementation for User Story 3

- [X] T022 [US3] `saveApplicationProfile` Server Action を service-front/src/features/application-sheet/server/actions.ts に実装する（upsert・1 ユーザー 1 件。T021 がパスすること）
- [X] T023 [US3] `ApplicationSheetForm` に「保存」ボタンと保存完了の `role="status"` フィードバックを追加する（保存対象は個人属性のみ・レンタル選択とトグルは送らない（FR-010）。ApplicationSheetForm.test.tsx に保存呼び出し・対象範囲のテストを追加してから実装する）
- [X] T024 [US3] `getApplicationSheetPrefill` に保存済み `application_profiles` の取得を追加し、復元値として defaultValues に反映する（自動入力（US2）より保存値を優先するのは手入力項目のみ。queries.test.ts にテストを追加してから実装する）

**Checkpoint**: 2 回目以降は再入力なしで 1 分以内に再生成できる（SC-004）

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 [P] Playwright + axe の a11y テストを service-front/tests/a11y/application-sheet.spec.ts に作成する（フォーム全項目のラベル・キーボード操作・axe 違反 0 件。WCAG 2.1 AA）
- [X] T026 [P] quickstart.md の全シナリオ（1〜4）を手動検証し、結果を記録する
- [X] T027 `npx biome check .` と対象テスト一式（`npx vitest run src/features/application-sheet` ほか）を実行し、すべてクリーンにする
- [X] T028 `/sync-spec` で実装と specs/032-dive-application-form/ のずれを確認し、必要なら仕様書を実装に合わせて更新する
- [X] T029 生成テキストの直接編集（FR-013）を追加する: SheetPreview を編集可能にし、手動編集後はフォーム変更で上書きしない・「フォームの内容から再生成」で復帰・コピーは編集後の内容を対象（テスト先行で SheetPreview.test.tsx に 6 ケース追加。spec.md / contracts へ FR-013 を追記）

---

## Dependencies

```text
Phase 1 (T001)
  └─ Phase 2 (T002〜T006)  ※ T003/T004 は並列可、T005 は T003/T004 依存
       ├─ Phase 3: US1 (T007〜T017)  ※ テスト T007〜T010 並列 → 実装 T011→T012/T013→T014→T015、T016/T017 並列
       ├─ Phase 4: US2 (T018〜T020)  ※ US1 の page.tsx / Form に接続するため US1 完了後を推奨
       └─ Phase 5: US3 (T021〜T024)  ※ Form / queries に接続するため US1（+US2 の queries）完了後を推奨
            └─ Phase 6: Polish (T025〜T028)
```

- US2・US3 はサーバー層（queries / actions）単体では US1 と独立にテスト可能だが、UI 接続タスク（T020・T023・T024）は US1 の成果物に依存する

## Parallel Execution Examples

- **Phase 2**: T003 と T004 を並列作成 → T005
- **US1 テスト**: T007・T008・T009・T010 を並列作成（すべて別ファイル）
- **US1 実装後半**: T016（proxy）と T017（TOP 導線）は T015 完了を待たず並列可
- **Polish**: T025 と T026 は並列可

## Implementation Strategy

1. **MVP = Phase 1〜3（US1）**: 手入力 → 生成 → コピーだけで価値が成立する。ここで一度動作確認・コミット
2. **Increment 2 = Phase 4（US2）**: prefill を接続し自動入力を有効化
3. **Increment 3 = Phase 5（US3）**: 保存・復元を追加（マイグレーションは Phase 2 で適用済み）
4. **仕上げ = Phase 6**: a11y・手動検証・biome・仕様書同期

---

## Phase 7: 複数シート保存（2026-07-11 追加要件）

**Goal**: シートを名前付きで複数保存し、一覧から選択・削除できる（保存対象はフォーム全体のスナップショット）

- [X] T030 マイグレーション: `application_profiles` を廃止し `application_sheets`（1 ユーザー N 件・name・全フォーム項目・rental_items jsonb・RLS select/insert/update/delete）に置き換える + Database 型更新
- [X] T031 types / constants / lib 更新: `SavedSheetSummary`・`sheetToFormValues`（行→フォーム値）・`SHEET_NAME_MAX_LENGTH`・`MAX_APPLICATION_SHEETS`。`SheetPrefill.savedProfile` を廃止
- [X] T032 queries: `listApplicationSheets` / `getApplicationSheet` を追加し、prefill から保存データ参照を除去（テスト先行）
- [X] T033 actions: `saveApplicationSheet`（名前必須・新規/上書き・上限件数）/ `deleteApplicationSheet`（テスト先行）
- [X] T034 `SavedSheetList` コンポーネント（一覧・選択リンク・削除）+ テスト + stories
- [X] T035 `ApplicationSheetForm` にシート名入力と新規/上書き保存を接続、page.tsx を `?sheet=<id>` で選択ロード対応（テスト先行）
- [X] T036 e2e（flows / a11y）を複数シート仕様に更新し実行、biome / tsc / 全ユニット確認
- [X] T037 spec.md / data-model.md / contracts / quickstart を複数シート仕様に同期

---

## Phase 8: 基本情報の保存とフォーム調整（2026-07-11 追加要件）

- [X] T038 `application_base_profiles`（1 ユーザー 1 件）を新設し、「基本情報を保存」ボタンで upsert・新規シート作成時にプロフィールより優先して自動入力する（FR-014。テスト先行）
- [X] T039 伊豆・千葉でのダイビング経験・ボートダイビング経験を廃止する（フォーム・出力・DB カラム・型・テスト）
- [X] T040 最終ダイブ年月を「2026年7月」形式のテキスト入力に変更する（DB は YYYY-MM 保持・`yearMonth` lib で相互変換）
- [X] T041 ドライスーツの経験「有」選択時のみ経験本数の入力欄を表示する
- [X] T042 経験セクションも基本情報の保存対象に含め、新規テーブルを application_sheets 1 つに統合する（kind='base' 行 + 部分ユニーク制約。PR 内マイグレーションを 1 本に squash）
