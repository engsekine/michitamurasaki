# Tasks: ダイブログへの写真添付

**Input**: Design documents from `/specs/012-photo-attachments/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/photo-actions.md, contracts/storage-layout.md, quickstart.md

**Tests**: Constitution III（Test-First）に従い、テストタスクを実装タスクの**前**に必須で含める。テストは先に書いて失敗を確認してから実装する。

**Organization**: ユーザーストーリー単位でフェーズを分け、各ストーリーを独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2 / US3）
- すべてのパスは worktree ルート `012-photo-attachments/` 基準

## Path Conventions

- Web app（モノレポ）: アプリは `service-front/src/`、型は `packages/supabase/src/`、DB は `supabase/`

---

## Phase 1: Setup（DB・Storage・型・依存の基盤）

**Purpose**: 写真メタテーブル・Storage バケット・RLS・型・画像処理依存の追加。アプリ実装の前提

- [X] T001 [P] `dive_photos` テーブルのマイグレーションを作成する: `supabase/migrations/<timestamp>_create_dive_photos.sql`（data-model.md どおり: カラム・FK（`dive_id`/`user_id` ともに `on delete cascade`）・CHECK（caption<=200, sort_order>=0）・インデックス（`idx_dive_photos_dive_id_sort_order` / `idx_dive_photos_user_id` / 部分ユニーク `idx_dive_photos_one_cover_per_dive`）・RLS 5 ポリシー（本人 SELECT/INSERT/UPDATE/DELETE + 公開 dive の anon SELECT、`(select auth.uid())` で包む）・`dive_photos_handle_updated_at` トリガ（既存 `public.handle_updated_at()` 再利用）・`comment on`）
- [X] T002 [P] Storage ポリシーのマイグレーションを作成する: `supabase/migrations/<timestamp>_create_dive_photos_storage_policies.sql`（data-model.md どおり: 判定関数 `public.is_public_dive_photo(text)`（`security definer` + `set search_path = ''`、`split_part(name,'/',2)` で dive_id 抽出）+ `storage.objects` 2 ポリシー（本人 ALL: パス先頭 = `auth.uid()`; anon/authenticated SELECT: `display`/`thumb` かつ公開 dive））
- [X] T003 [P] `supabase/config.toml` に `[storage.buckets.dive-photos]` を追加する（`public = false` / `file_size_limit = "10MiB"` / `allowed_mime_types` = jpeg,png,webp,heic,heif — contracts/storage-layout.md）
- [X] T004 [P] `service-front` に `sharp` を依存追加する（package.json）。画像処理 Action を Node.js ランタイムで動かす前提を確認（research R1 / R2）
- [X] T005 `packages/supabase/src/types.ts` の `Database['public']['Tables']` に `dive_photos` の Row / Insert / Update / Relationships を追加する（既存 `dives` と同形式）。`supabase db reset` でマイグレーション適用を確認する
- [X] T006 [P] `service-front/next.config.*` の `images.remotePatterns` に Supabase Storage ホストを許可する（research R6）

**Checkpoint**: `supabase db reset` 成功・`supabase storage ls` に `dive-photos`・型が解決する（quickstart.md 前提節）

---

## Phase 2: Foundational（全ストーリー共通の純粋関数・処理・取得・表示部品）

**Purpose**: 3 ストーリーすべてが依存する型・検証・パス生成・画像処理・取得クエリ・表示部品

**⚠️ CRITICAL**: このフェーズ完了まで各ユーザーストーリーには着手しない

- [X] T007 `service-front/src/features/dives/types.ts` に `DivePhoto` / `DivePhotoView` を追加する（data-model.md「アプリ層の型」どおり）
- [X] T008 [P] `photoStorage` / `photoValidation` の Vitest を先に書く: `service-front/src/features/dives/lib/photoStorage.test.ts` / `photoValidation.test.ts`（パス生成 `{user_id}/{dive_id}/{kind}/{id}.{ext}`・kind/ext 判定 / 枚数<=10・容量<=10MB・許可 MIME の合否、境界値）。実装前に失敗を確認
- [X] T009 [P] `photoStorage`（バケット名・パス生成・拡張子判定の純粋関数）を実装する: `service-front/src/features/dives/lib/photoStorage.ts`。T008 を green に
- [X] T010 [P] `photoValidation`（枚数 / 容量 / MIME のクライアント＆サーバー共通検証の純粋関数）を実装する: `service-front/src/features/dives/lib/photoValidation.ts`。T008 を green に
- [X] T011 [P] `imageProcessing` の Vitest を先に書く: `service-front/src/features/dives/lib/imageProcessing.test.ts`（GPS 付き JPEG → 出力にメタなし(INV-4) / Orientation 付き → 寸法が正しく回転 / HEIC 入力 → WebP 出力 / 長辺 2048px・サムネ 480px に収まる・拡大なし / 出力 width/height を返す）。サンプル画像を fixture で用意。実装前に失敗を確認
- [X] T012 `imageProcessing`（`sharp` で回転適用 → 全メタ除去 → 表示用 WebP 長辺2048px/q80・サムネイル WebP 長辺480px/q75・拡大なし）を実装する: `service-front/src/features/dives/lib/imageProcessing.ts`（FR-009 / FR-016 / FR-017。寸法は research R1 確定値）。T011 を green に
- [X] T013 `photo.schema.ts`（キャプション yup スキーマ <=200 文字）を作成する: `service-front/src/features/dives/schemas/photo.schema.ts`
- [X] T014 [P] `PhotoThumbnail`（`next/image` ラッパ・`alt` 必須・遅延読込・アスペクト保持）の test と story を先に書く: `service-front/src/shared/components/media/PhotoThumbnail/PhotoThumbnail.test.tsx` / `PhotoThumbnail.stories.tsx`（alt 必須・width/height 反映・loading=lazy）。実装前に失敗を確認
- [X] T015 [P] `PhotoThumbnail` を Server Component として実装する: `service-front/src/shared/components/media/PhotoThumbnail/PhotoThumbnail.tsx` + `index.ts`（Tailwind utility-first・Client 化しない）。T014 を green に
- [X] T016 [P] `photoQueries`（本人向け）の Vitest を先に書く（純粋ロジックは `lib/photoView.test.ts` に分離。`getDivePhotos` の I/O は規約どおり E2E/RLS テストでカバー）: `service-front/src/features/dives/server/photoQueries.test.ts`（`sort_order` 昇順で `DivePhotoView[]` を返す / 表示用・サムネイルの署名 URL を解決 / alt は caption 優先・無ければログ情報由来 / 0 枚は空配列）。実装前に失敗を確認
- [X] T017 `photoQueries`（本人向け: dive の写真を `sort_order` 昇順取得 + 表示用署名 URL 発行 → `DivePhotoView[]`）を実装する: `service-front/src/features/dives/server/photoQueries.ts`（`'server-only'`、純粋変換は `lib/photoView.ts` に分離。R6）

**Checkpoint**: `pnpm test -- src/features/dives/lib src/features/dives/server/photoQueries.test.ts` と PhotoThumbnail テストが green

---

## Phase 3: User Story 1 - ログに写真を添付して見返す (Priority: P1) 🎯 MVP

**Goal**: 自分のダイブログに写真を添付（新規作成時・編集時）し、詳細画面で閲覧できる

**Independent Test**: ユーザー A で詳細を開き写真を添付 → 表示される。他ユーザー/未認証は操作不可（quickstart.md US1 / 所有権節 シナリオ 1〜8）

> 補足: `deleteDivePhoto`（FR-013）は spec 上は US3（整理）の操作だが、添付と対で必要なため本フェーズで併せて実装する（cover 自動昇格を含む）。並び替え・キャプション・代表指定の編集 UI は US3 で扱う。

### Tests for User Story 1（先に書いて失敗を確認）

- [X] T018 [P] [US1] `addDivePhoto` / `deleteDivePhoto` の Vitest を書く: `service-front/src/features/dives/server/photoActions.test.ts`（認証なし→失敗 / 他人の dive→失敗 / 11 枚目→上限エラー / 非対応形式→形式エラー / 正常時 `dive_photos` 行作成・原本削除・初回 is_cover=true / delete 時 cover 自動昇格 — contracts/photo-actions.md）
- [X] T019 [P] [US1] `DivePhotoUploader` の test と story を書く: `service-front/src/features/dives/components/client/DivePhotoUploader/DivePhotoUploader.test.tsx` / `.stories.tsx`（label 関連付け・複数選択プレビュー・クライアント検証エラー表示・進捗 `aria-live`・部分失敗の再試行）
- [X] T020 [P] [US1] `DivePhotoGallery` の test と story を書く: `service-front/src/features/dives/components/server/DivePhotoGallery/DivePhotoGallery.test.tsx` / `.stories.tsx`（写真の順序表示・各画像に alt・0 枚時の非表示 or プレースホルダ）

### Implementation for User Story 1

- [X] T021 [US1] `addDivePhoto` / `deleteDivePhoto` を実装する: `service-front/src/features/dives/server/photoActions.ts`（`'use server'`・`ActionResult<T>`・auth + 所有権確認・サーバー再検証・`imageProcessing` 呼び出し・Storage 書込/原本削除・INSERT/DELETE・cover 自動昇格・`revalidatePath('/dives/[id]')` — contracts/photo-actions.md）
- [X] T022 [US1] `DivePhotoUploader` を Client Component として実装する: `service-front/src/features/dives/components/client/DivePhotoUploader/DivePhotoUploader.tsx` + `index.ts`（browser Supabase client で原本を直アップロード → `addDivePhoto` 呼び出し。`'use client'`、進捗・エラー UI、`photoValidation` 利用）
- [X] T023 [US1] `DivePhotoGallery` を Server Component として実装する: `service-front/src/features/dives/components/server/DivePhotoGallery/DivePhotoGallery.tsx` + `index.ts`（`photoQueries` → `PhotoThumbnail`/拡大表示。各画像 alt 必須）
- [X] T024 [US1] `DiveDetail` にギャラリーとアップローダ（本人時）を差し込む: `service-front/src/features/dives/components/server/DiveDetail/DiveDetail.tsx`（写真セクション追加。閲覧は誰でも・編集導線は本人のみ）
- [X] T025 [US1] ログ新規作成時の写真添付を結線する: `service-front/src/features/dives/components/client/DiveForm/DiveForm.tsx` + `service-front/src/features/dives/hooks/useDiveFormSubmit.ts`（**確定フロー: ログを先に保存して dive_id を確定 → その dive_id 配下へアップロード → `addDivePhoto`**。dive_id 未確定状態ではアップロードしない — FR-001 AC2）
- [X] T026 [US1] `service-front/src/features/dives/index.ts` に新規公開コンポーネント・型を re-export する

**Checkpoint**: `/dives/[id]` で添付→表示・削除ができ、他ユーザー/未認証は操作不可（quickstart US1 完了）。**ここまでで MVP 出荷可能**

---

## Phase 4: User Story 2 - 公開ログで写真を共有する (Priority: P2)

**Goal**: 公開ログ（`is_public=true`）の写真を未認証者が公開経路で閲覧でき、非公開写真は遮断される

**Independent Test**: 公開/非公開を切り替え、anon が display/thumb を取得可/不可、`orig` は常に不可（quickstart US2 シナリオ 9〜13 / INV-2,3）

> 公開ページのルート（`public_slug` 解決ページ）は本 feature スコープ外（research R4）。本フェーズは Storage RLS・取得クエリ・ギャラリー再利用を公開対応にし、ルート追加時に結線できる状態にする。

### Tests for User Story 2（先に書いて失敗を確認）

- [ ] T027 [P] [US2] 公開/非公開の RLS 検証テストを書く: `service-front/src/features/dives/server/photoQueries.public.test.ts`（公開 dive → anon が display/thumb 取得可 / 非公開 → 取得不可(INV-3) / `orig` は anon 不可(INV-2) / 非公開化で即遮断 — FR-006/007/008）

### Implementation for User Story 2

- [ ] T028 [US2] `photoQueries` に公開ページ向け取得を追加する: `service-front/src/features/dives/server/photoQueries.ts`（`public_slug` から公開 dive を解決し、`is_public=true` のときのみ署名 URL を発行して `DivePhotoView[]` を返す。非公開は空/null）
- [ ] T029 [US2] `DivePhotoGallery` を公開コンテキストでも再利用できるようにする: `service-front/src/features/dives/components/server/DivePhotoGallery/DivePhotoGallery.tsx`（編集導線を出さない read-only モードの prop を追加。既存テスト T020 を更新）
- [ ] T030 [US2] 公開ページ依存を明文化する: `specs/012-photo-attachments/quickstart.md` の US2 節に沿って、公開ページルート実装時の結線手順（`DivePhotoGallery` を read-only で配置）を README/コメントに残す（ルート自体は 002 公開機能で実装）

**Checkpoint**: anon の公開/非公開アクセス可否が RLS で正しく制御される（quickstart US2 完了）

---

## Phase 5: User Story 3 - 写真を整理する (Priority: P3)

**Goal**: 複数枚の並び替え・代表写真指定・キャプション編集・削除ができる

**Independent Test**: 複数枚で並び替え/代表指定/キャプション/削除し、詳細（公開時は公開ページ）に反映（quickstart US3 シナリオ 15〜19）

### Tests for User Story 3（先に書いて失敗を確認）

- [ ] T031 [P] [US3] `reorderDivePhotos` / `setCoverPhoto` / `updatePhotoCaption` の Vitest を書く: `service-front/src/features/dives/server/photoActions.reorder.test.ts`（並び順一括更新・ID 集合不一致でエラー / cover 一意（部分ユニーク整合）/ caption <=200 検証・空で未設定化 — contracts/photo-actions.md）

### Implementation for User Story 3

- [ ] T032 [US3] `reorderDivePhotos` / `setCoverPhoto` / `updatePhotoCaption` を `photoActions.ts` に追加する: `service-front/src/features/dives/server/photoActions.ts`（FR-010/011/012。所有権確認・`revalidatePath`）
- [ ] T033 [US3] `DivePhotoUploader`（またはギャラリー編集 UI）に並び替え・代表指定・キャプション編集・個別削除の操作を追加する: `service-front/src/features/dives/components/client/DivePhotoUploader/DivePhotoUploader.tsx`（キーボード操作可能・`aria` 適切。FR-010〜FR-013）
- [ ] T034 [US3] ギャラリー/カードのサムネイルに代表写真を使う: `service-front/src/features/dives/components/client/DiveCard/DiveCard.tsx`（`is_cover` の `thumb` を `PhotoThumbnail` で表示 — FR-011。既存 DiveCard テストを更新）

**Checkpoint**: 整理操作が詳細に反映され、代表写真がカードに出る（quickstart US3 完了）

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 横断的な仕上げ・エッジケース・回帰防止

- [X] T035（2026-07-02 完了）ログ削除時の Storage 孤児削除を結線する: `service-front/src/features/dives/server/actions.ts` の `deleteDive` を拡張し、`{user_id}/{dive_id}/` プレフィックスを一括削除する（FR-014 / data-model.md エンティティ関係。回帰テストを `actions` のテストに追加）
- [ ] T036 [P] アップロード中断・部分失敗のハンドリングを検証・補強する: `DivePhotoUploader`（失敗分のみ未保存・既存写真とログ本体は無事 — FR-015。該当テストを T019 に追加）
- [ ] T037 [P] a11y テスト（Playwright + axe-core）を追加する: `service-front/tests/a11y/dives-photos.spec.ts`（詳細ページの写真セクション・アップローダのキーボード操作 — accessibility.md / Constitution V）
- [ ] T038 [P] `/sync-spec specs/012-photo-attachments` 相当の整合確認 — 実装後に data-model.md / contracts と schema・migration・component のズレがないか確認し、ズレがあれば仕様書を実装に合わせて更新する
- [ ] T039 quickstart.md の全シナリオ（US1〜US3・プライバシー INV-4・エッジケース 20〜22）を手動で一通り実行し、結果を記録する

---

## Dependencies & Execution Order

```text
Phase 1 (Setup: T001-T006)
   └─> Phase 2 (Foundational: T007-T017)   ← 全ストーリーの前提
          ├─> Phase 3 US1 (T018-T026) 🎯 MVP   ← 単独で出荷可能
          ├─> Phase 4 US2 (T027-T030)          ← Foundational 後に着手可（US1 と概ね独立）
          └─> Phase 5 US3 (T031-T034)          ← Foundational 後に着手可（US1 完了後が自然）
   Phase 6 (Polish: T035-T039)               ← 対象ストーリー完了後
```

- **Test-First**: 各実装タスクは対応するテストタスク（同フェーズの直前 [P] タスク）が green になることをゴールにする（Constitution III）。
- **US1 → US2/US3 の関係**: US2・US3 は Foundational さえ終われば着手できるが、UI 上は US1（アップローダ・ギャラリー）に乗るため、実運用では US1 完了後に US2/US3 を重ねるのが自然。
- **公開ページ依存**: US2 の「画面表示」は 002 公開機能（`public_slug` ルート）が前提。本 feature はデータ・RLS・クエリまで提供。

## Parallel Opportunities

- **Setup**: T001 / T002 / T003 / T004 / T006 は別ファイルで並列可（T005 は T001-T002 後）
- **Foundational**: T008→(T009,T010) 並列、T011（テスト）→T012（実装）、T014・T016 はテスト先行で並列可、T015 は T014 後
- **US1**: テスト T018 / T019 / T020 を並列で先行作成 → 実装 T021-T025
- **US3**: T031（テスト）先行 → T032-T034
- **Polish**: T036 / T037 / T038 は並列可

## Implementation Strategy

1. **MVP = Phase 1 + 2 + 3（US1）**。自分のログに写真を添付・閲覧・削除でき、ここで単独リリース可能。
2. **増分 1 = US3（整理）**: 複数枚運用の満足度向上。公開ページ非依存。
3. **増分 2 = US2（公開共有）**: Storage RLS・クエリは本 feature で用意し、公開ページルート（002）の実装と結線して有効化。
4. 各フェーズ完了時に `/review` と仕様書同期（T038）を実施してからコミット（Conventional Commits）。
