---

description: "Task list for 運営管理画面（admin-front）"
---

# Tasks: 運営管理画面（admin-front）

**Input**: Design documents from `/specs/015-admin-panel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Constitution III（Test-First / テスト同梱）が必須のため、コンポーネント（Vitest + Storybook + Playwright a11y）・RLS・E2E のテストタスクを含める。

**Organization**: ユーザーストーリー単位でフェーズを構成し、各ストーリーを独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（別ファイル・未完タスクに依存しない）
- **[Story]**: 対応するユーザーストーリー（US1〜US5）
- 各タスクに正確なファイルパスを記載

## Path Conventions

- 新規アプリ: `admin-front/src/...`（service-front の Feature-based 構成を踏襲）
- 共有パッケージ: `packages/supabase/...` / `packages/ui/...`
- マイグレーション: `supabase/migrations/<timestamp>_<verb>_<target>.sql`
- 既存アプリ影響: `service-front/src/...`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: admin-front アプリの初期化と共有クライアント整備

- [X] T001 `admin-front/` を新規 Next.js アプリとして scaffold（`admin-front/package.json` name="admin-front"、`next.config.ts`、`tsconfig.json`、`postcss.config.mjs`、`biome` 設定を service-front から踏襲）— dev ポートは 3001（`next dev -p 3001`）
- [ ] T002 [P] テスト基盤を設定（`admin-front/vitest.config.ts`・`vitest.setup.ts`・`playwright.config.ts`・Storybook 設定 `.storybook/`）を service-front 同等に整備
- [X] T003 [P] Tailwind / グローバルスタイルを設定（`admin-front/src/app/globals.css`・Tailwind 4 セットアップ）
- [X] T004 `@repo/supabase` の認証 Cookie 名を引数 / 環境変数で差し替え可能化（`packages/supabase/src/constants.ts`・`server.ts`・`browser.ts`・`middleware.ts` を変更し、既定値は後方互換で `sb-divelog-auth-token` を維持）
- [X] T005 [P] admin 用 Supabase クライアントラッパを作成（`admin-front/src/shared/lib/supabase/{server,browser,middleware}.ts`、Cookie 名 `sb-divelog-admin-auth-token` を注入）
- [X] T006 [P] admin 用 metadata 設定を作成（`admin-front/src/shared/config/metadata.ts`、`generatePageMetadata` 相当・`robots: noindex,nofollow`）
- [X] T007 [P] 共有型 `ActionResult` ヘルパを配置（`admin-front/src/shared/types/action-result.ts`、service-front と同実装）

**Checkpoint**: admin-front が起動でき、Supabase へ admin 専用 Cookie で接続できる

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ストーリーが依存する DB スキーマ・権限基盤・UI シェル

**⚠️ CRITICAL**: このフェーズ完了まで各ユーザーストーリーの実装は開始不可

### マイグレーション（data-model.md 準拠）

- [X] T008 `admin_users` テーブル + RLS + `updated_at` トリガを作成（`supabase/migrations/<ts>_create_admin_users.sql`）
- [X] T009 `public.is_admin()` 関数を作成（`supabase/migrations/<ts>_create_is_admin_function.sql`、`security definer` / `set search_path = ''` / `stable`、依存: T008）
- [X] T010 [P] `admin_audit_logs` テーブル + RLS（select/insert のみ）+ インデックスを作成（`supabase/migrations/<ts>_create_admin_audit_logs.sql`、依存: T008）
- [X] T011 [P] 管理対象テーブルへ `deleted_at` 列 + 部分インデックスを追加（`supabase/migrations/<ts>_add_soft_delete_columns.sql`：`dives`・`dive_sites`・`dive_photos`）
- [X] T012 各管理対象テーブルへ admin RLS ポリシー（`for all using/with check (select public.is_admin())`）を追加（`supabase/migrations/<ts>_add_admin_rls_policies.sql`、依存: T009／既存「本人のみ」ポリシーは残す）
- [X] T013 初期管理者の seed を追加（`supabase/seed.sql` に `superadmin` を 1 件投入する手順／コメント）

### 権限ゲート・監査基盤

- [X] T014 `requireAdmin()` ガードと `AdminUser` 型を実装（`admin-front/src/features/admin-auth/server/guard.ts`、依存: T009）
- [X] T015 [P] 監査記録ユーティリティ `recordAudit()` を実装（`admin-front/src/shared/lib/audit/recordAudit.ts`、`actor_id` はサーバーで解決、依存: T010・T014）
- [ ] T016 [P] RLS 単体テスト（非管理者セッションで管理対象テーブルへ read/write が拒否/0 件・監査ログ更新削除が拒否）を追加（`admin-front/tests/rls/admin-rls.test.ts`、依存: T012）

### 共有 UI シェル・部品

- [X] T017 [P] AdminShell（サイドバー + ヘッダー + メイン）レイアウト部品を作成（`admin-front/src/shared/components/layout/AdminShell/` + AdminSidebar・AdminHeader、`aria-current` 対応）
- [X] T018 [P] 共有テーブル部品 DataTable / Pagination / EmptyState を作成（`admin-front/src/shared/components/table/{DataTable,Pagination,EmptyState}/`）
- [X] T019 [P] 破壊的操作確認ダイアログ ConfirmDialog とトースト Toast を作成（`admin-front/src/shared/components/feedback/{ConfirmDialog,Toast}/`、`role="dialog"`・フォーカストラップ・Esc）
- [X] T020 [P] 共有フォーム部品 FormField / FormSelect / FormTextarea を作成（`admin-front/src/shared/components/form/`、service-front から共通化）
- [ ] T021 共有部品のテスト類を生成（T017〜T020 完了後に `/generate-with-tests` で各コンポーネントの Vitest + Storybook + Playwright a11y を生成）

**Checkpoint**: スキーマ・`is_admin()`・監査・UI シェルが揃い、各ストーリーを並行開始できる

---

## Phase 3: User Story 1 - 管理者としてログインし管理画面に入る (Priority: P1) 🎯 MVP

**Goal**: 管理者のみが admin-front にログインしダッシュボードへ到達でき、非管理者・未認証は全 URL で拒否される（セキュリティ境界の確立）

**Independent Test**: 管理者ログイン→ダッシュボード到達／非管理者 URL 直打ち→拒否／未認証→ログイン誘導／ログアウト後→アクセス不可、をそれぞれ単独検証

### Tests for User Story 1 ⚠️

- [ ] T022 [P] [US1] E2E: 認証・権限境界シナリオ（S1）を作成（`admin-front/tests/e2e/admin-auth.spec.ts`：未認証リダイレクト・非管理者拒否・管理者ログイン・ログアウト）

### Implementation for User Story 1

- [X] T023 [P] [US1] ログインスキーマを作成（`admin-front/src/features/admin-auth/schemas/login.schema.ts`、yup）
- [X] T024 [US1] `signInAdmin` / `signOutAdmin` Server Action を実装（`admin-front/src/features/admin-auth/server/actions.ts`、`contracts/admin-auth.md` 準拠：ログイン後 `is_admin` 確認、非管理者は即 signOut、依存: T014）
- [X] T025 [US1] 権限ゲート `proxy.ts` を実装（`admin-front/src/proxy.ts`：未認証→`/login`、認証済み非管理者→拒否、管理者→通過。matcher は静的アセット除外）
- [X] T026 [P] [US1] LoginForm（client）を作成（`admin-front/src/features/admin-auth/components/client/LoginForm/`、`register` 戻り値 spread のみ、`role="alert"` エラー）
- [X] T027 [US1] ログインページを作成（`admin-front/src/app/(auth)/login/page.tsx`、`generatePageMetadata` を export）
- [X] T028 [US1] `(admin)` レイアウトを作成し AdminShell + `requireAdmin()` を統合（`admin-front/src/app/(admin)/layout.tsx`、依存: T014・T017）
- [X] T029 [US1] admin-auth の公開 API バレルを作成（`admin-front/src/features/admin-auth/index.ts`）
- [X] T030 [US1] LoginForm のテスト類を生成（`/generate-with-tests admin-front/src/features/admin-auth/components/client/LoginForm/LoginForm.tsx`）

**Checkpoint**: 認証・権限境界が独立して機能（MVP の安全基盤）

---

## Phase 4: User Story 2 - データを一覧・検索して詳細を確認する (Priority: P1)

**Goal**: サイドバーから管理対象を選び、ページング一覧・検索・詳細表示ができる（閲覧で問い合わせ対応・調査の価値を提供）

**Independent Test**: 各対象の一覧表示・キーワード検索・件数表示・1 件詳細表示を編集機能なしで単独検証

### Tests for User Story 2 ⚠️

- [ ] T031 [P] [US2] E2E: 一覧・検索・詳細・空状態シナリオ（S2）を作成（`admin-front/tests/e2e/admin-list.spec.ts`）
- [X] T032 [P] [US2] 一覧クエリの単体テスト（ページング・検索・並び替え許可リスト・0 件）を作成（`admin-front/src/shared/lib/resource/listResource.test.ts`）

### Implementation for User Story 2

- [X] T033 [P] [US2] 汎用一覧クエリ `listResource` / `getResourceDetail` を実装（`admin-front/src/shared/lib/resource/queries.ts`、`contracts/admin-resource.md`：`range()`+count・必要カラムのみ・キーワード検索・**主要項目での項目別フィルタ（許可リスト）**・並び替え許可リスト・`deleted_at is null` 既定、依存: T014）
- [X] T034 [P] [US2] users-admin の一覧・詳細 query と mapper を実装（`admin-front/src/features/users-admin/server/queries.ts`、関連サマリ＝ダイブログ件数）
- [X] T035 [P] [US2] dives-admin の一覧・詳細 query を実装（`admin-front/src/features/dives-admin/server/queries.ts`）
- [X] T036 [P] [US2] dive-sites-admin の一覧 query を実装（`admin-front/src/features/dive-sites-admin/server/queries.ts`）
- [X] T037 [P] [US2] 汎用テーブルエディタの許可リスト + メタ駆動一覧 query を実装（`admin-front/src/features/table-editor/{constants.ts,server/queries.ts}`、生成型から列導出・許可テーブル限定。許可リストに `user_details` 等を含め、**users の編集経路を汎用エディタで賄う**方針を明記）
- [X] T038 [US2] users 一覧・詳細ページを作成（`admin-front/src/app/(admin)/users/page.tsx`・`[id]/page.tsx`、`notFound()` 連携、`generatePageMetadata` を export、依存: T034・T018）
- [X] T039 [US2] dives 一覧・詳細ページを作成（`admin-front/src/app/(admin)/dives/page.tsx`・`[id]/page.tsx`、`generatePageMetadata` を export、依存: T035・T018）
- [X] T040 [US2] dive-sites 一覧ページを作成（`admin-front/src/app/(admin)/dive-sites/page.tsx`、`generatePageMetadata` を export、依存: T036・T018）
- [X] T041 [US2] 汎用テーブルエディタ一覧ページを作成（`admin-front/src/app/(admin)/tables/[table]/page.tsx`、`generatePageMetadata` を export、依存: T037・T018）
- [X] T042 [US2] 検索フォーム（client）を作成（`admin-front/src/shared/components/table/TableSearchBar/`、URL クエリ同期）
- [X] T043 [US2] サイドバーのナビ項目を各一覧へ配線（`admin-front/src/shared/components/layout/AdminShell/AdminSidebar`、`aria-current`）
- [X] T044 [US2] 各 feature の公開 API バレルを作成（`users-admin`・`dives-admin`・`dive-sites-admin`・`table-editor` の `index.ts`）
- [ ] T045 [US2] 新規 client コンポーネントのテスト類を生成（`/generate-with-tests` で T042 等）

**Checkpoint**: 一覧・検索・詳細が独立して機能

---

## Phase 5: User Story 3 - データを編集・作成・削除する (Priority: P1)

**Goal**: 詳細/フォームからレコードを編集、マスタを新規作成、ソフトデリート（確認付き）でき、監査ログに記録される（管理画面の主目的）

**Independent Test**: ダイブサイトで 作成→一覧反映→編集→反映→削除→一覧から消える→復元 を単独検証

### Tests for User Story 3 ⚠️

- [ ] T046 [P] [US3] E2E: 作成・編集・削除・復元・参照整合性（参照ありの物理削除はブロックし件数提示）・楽観ロック競合・検証エラーシナリオ（S3）を作成（`admin-front/tests/e2e/admin-crud.spec.ts`）
- [X] T047 [P] [US3] mutation + 監査記録の単体テスト（成功時に監査 1 行・監査失敗時に mutation も失敗・楽観ロック競合）を作成（`admin-front/src/shared/lib/resource/mutations.test.ts`）

### Implementation for User Story 3

- [X] T048 [US3] 汎用 mutation `createResource` / `updateResource` / `softDeleteResource` / `restoreResource` / `hardDeleteResource` を実装（`admin-front/src/shared/lib/resource/actions.ts`、サーバー再検証・`updated_at` 楽観ロック（競合時はブロックし再読込促す / FR-022）・参照整合性チェック（物理削除は参照ありならブロックし件数提示 / FR-014）・`recordAudit` 呼び出し・`revalidatePath`、依存: T015・T033）
- [X] T049 [P] [US3] dive-sites の作成/編集スキーマを作成（`admin-front/src/features/dive-sites-admin/schemas/dive-site.schema.ts`、yup：name 必須/100 字・area/description 上限）
- [X] T050 [P] [US3] dives の編集スキーマを作成（`admin-front/src/features/dives-admin/schemas/dive-edit.schema.ts`、既存 CHECK 制約を反映）
- [X] T051 [US3] dive-sites の作成/編集 Server Action を実装（`admin-front/src/features/dive-sites-admin/server/actions.ts`、依存: T048・T049）
- [X] T052 [US3] dives の編集 Server Action を実装（`admin-front/src/features/dives-admin/server/actions.ts`、依存: T048・T050）
- [X] T053 [P] [US3] DiveSiteForm（client、新規/編集兼用）を作成（`admin-front/src/features/dive-sites-admin/components/client/DiveSiteForm/`、`Controller` 経由）
- [X] T054 [P] [US3] DiveEditForm（client）を作成（`admin-front/src/features/dives-admin/components/client/DiveEditForm/`）
- [X] T055 [US3] dive-sites 新規/編集ページを作成（`admin-front/src/app/(admin)/dive-sites/new/page.tsx`・`[id]/edit/page.tsx`）
- [X] T056 [US3] dives 編集ページを作成（`admin-front/src/app/(admin)/dives/[id]/edit/page.tsx`）
- [ ] T057 [US3] 汎用テーブルエディタの編集 Server Action + フォーム（メタ駆動）を実装（`admin-front/src/features/table-editor/server/actions.ts` + `components/client/TableEditorForm/`、許可リスト・型/NOT NULL/CHECK 反映。**users / user_details の編集はこの汎用エディタ経由**（個人情報カラムは許可リストで露出制御）、依存: T037・T048）（2026-07-02 監査で実装未達と判明し差し戻し）
- [ ] T058 [US3] 削除/復元の ConfirmDialog を各一覧・詳細に配線（一覧の行操作・詳細の削除ボタンから T019 を必須通過）（2026-07-02 監査で実装未達と判明し差し戻し）
- [ ] T059 [US3] 操作結果トースト（保存/作成/削除/エラー）を配線（FR-020、T019 の Toast）（2026-07-02 監査で実装未達と判明し差し戻し）
- [X] T060 [US3] 【クロスアプリ影響】service-front の利用者向けクエリ/RLS に `deleted_at is null` を反映（`service-front/src/features/{dives,dive-sites}/lib/` のクエリビルダー or 利用者 select ポリシー）+ 回帰テスト（ソフトデリート済みが利用者側に出ない）を追加
- [X] T061 [US3] FR-015 保護を実装（最後の superadmin / 自分自身の無効化をアプリ層でブロック。`admin-front/src/features/admin-auth/server/actions.ts` 付近）。`admin_users` への操作経路（汎用エディタ or 将来の管理者管理 UI）すべてに適用する。**MVP では管理者の追加/無効化は seed（T013）運用とし、専用の管理者管理 UI 画面は後続スコープ**（必要時に別タスクで追加）
- [ ] T062 [US3] 新規フォームコンポーネントのテスト類を生成（`/generate-with-tests` で T053・T054・TableEditorForm）

**Checkpoint**: 作成・編集・ソフトデリート・復元・監査が独立して機能（管理画面の主機能完成）

---

## Phase 6: User Story 4 - 運営状況をダッシュボードで把握する (Priority: P2)

**Goal**: ログイン後トップで主要 KPI を数値表示し、カードから各一覧へ遷移できる

**Independent Test**: ダッシュボードに登録ユーザー数・ダイブログ総数等が表示され、カードから対応一覧へ遷移できることを単独検証

### Tests for User Story 4 ⚠️

- [ ] T063 [P] [US4] E2E: ダッシュボード KPI 表示・カード遷移シナリオ（S4）を作成（`admin-front/tests/e2e/admin-dashboard.spec.ts`）

### Implementation for User Story 4

- [ ] T064 [P] [US4] ダッシュボード KPI 集計 query を実装（`admin-front/src/features/dashboard/server/queries.ts`：ユーザー数・ダイブログ総数・直近増加傾向、count ベース）（2026-07-02 監査で実装未達と判明し差し戻し。ユーザー数・ダイブログ総数・サイト数の count は実装済みだが増加傾向が未実装）
- [X] T065 [P] [US4] KpiCard（client、リンク付き）を作成（`admin-front/src/features/dashboard/components/client/KpiCard/`）
- [X] T066 [US4] ダッシュボードページを作成（`admin-front/src/app/(admin)/page.tsx`、`generatePageMetadata` を export、依存: T064・T065）
- [X] T067 [US4] dashboard 公開 API バレル + テスト類生成（`admin-front/src/features/dashboard/index.ts` + `/generate-with-tests` で T065）

**Checkpoint**: ダッシュボードが独立して機能

---

## Phase 7: User Story 5 - 操作履歴を追える (Priority: P3)

**Goal**: 誰がいつどのレコードに編集・削除したかを操作ログ一覧で時系列確認できる

**Independent Test**: 任意の編集・削除後、操作ログに「実行者・対象・操作種別・日時」が記録され一覧で確認できることを単独検証

### Tests for User Story 5 ⚠️

- [ ] T068 [P] [US5] E2E: 操作ログ記録・一覧表示シナリオ（S5）を作成（`admin-front/tests/e2e/admin-audit.spec.ts`）

### Implementation for User Story 5

- [X] T069 [P] [US5] `listAuditLogs` query を実装（`admin-front/src/features/audit-log/server/queries.ts`：`created_at desc`・フィルタ・`admin_users.display_name` join、`contracts/admin-audit.md`）
- [X] T070 [US5] 操作ログ一覧ページを作成（`admin-front/src/app/(admin)/audit-logs/page.tsx`、DataTable 利用、`generatePageMetadata` を export、依存: T069・T018）
- [X] T071 [US5] audit-log 公開 API バレル + サイドバー導線を追加（`admin-front/src/features/audit-log/index.ts` + AdminSidebar）

**Checkpoint**: 監査ログ参照が独立して機能（全ストーリー完了）

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリー横断の品質・性能・整合性

- [ ] T072 [P] 全画面の Playwright + axe-core a11y テストを補完（WCAG 2.1 AA、`admin-front/tests/a11y/`）
- [ ] T073 [P] 性能確認：一覧・検索が数万件で約 2 秒以内（SC-004）。必要インデックス（検索/並び替えカラム）の追加マイグレーションを検討
- [ ] T074 [P] セッション期限切れ時の保存挙動（再ログイン誘導・入力喪失防止 / Edge Case）を確認・対応
- [ ] T075 quickstart.md の S1〜S5 を手動実行して受け入れ確認（SC-001〜006 対応表）
- [X] T076 [P] `/sync-spec specs/015-admin-panel` で実装と仕様書の整合を確認・更新
- [ ] T077 `/review 015-admin-panel` でコード規約・影響範囲・共通化をチェック

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。即開始可
- **Foundational (Phase 2)**: Setup 完了に依存。全ユーザーストーリーをブロック
- **User Stories (Phase 3-7)**: Foundational 完了に依存
  - US1（認証境界）は MVP 安全基盤として最優先
  - US2・US3 は P1。US3 は US2 の `listResource`/詳細（T033）に一部依存
  - US4（P2）・US5（P3）は Foundational さえ済めば独立着手可
- **Polish (Phase 8)**: 対象ストーリー完了に依存

### User Story Dependencies

- **US1 (P1)**: Foundational 後に開始。他ストーリー非依存
- **US2 (P1)**: Foundational 後。`(admin)` レイアウト（T028/US1）があると望ましいが一覧 query は独立検証可
- **US3 (P1)**: US2 の汎用 query（T033）に依存。それ以外は独立
- **US4 (P2)**: Foundational 後。独立
- **US5 (P3)**: Foundational の `recordAudit`（T015）で記録され、参照は独立

### Within Each User Story

- テストを先に書き、失敗を確認してから実装（Constitution III）
- マイグレーション → 関数 → ポリシー の順（T008→T009→T012）
- query/スキーマ → Server Action → ページ → client コンポーネント配線
- コンポーネント実装後に `/generate-with-tests`

### Parallel Opportunities

- Setup の [P]（T002・T003）、Foundational マイグレーション T010・T011 と UI 部品 T017〜T020 は並列
- Foundational 完了後、US1〜US5 を別担当で並行実装可
- 各ストーリー内の query/スキーマ群（例 T034〜T037、T049/T050）は別ファイルで並列

---

## Parallel Example: User Story 2

```bash
# US2 の一覧クエリ群を並列実装:
Task: "users-admin queries in admin-front/src/features/users-admin/server/queries.ts"
Task: "dives-admin queries in admin-front/src/features/dives-admin/server/queries.ts"
Task: "dive-sites-admin queries in admin-front/src/features/dive-sites-admin/server/queries.ts"
Task: "table-editor queries in admin-front/src/features/table-editor/server/queries.ts"
```

---

## Implementation Strategy

### MVP First（US1 → US2 → US3）

1. Phase 1 Setup → Phase 2 Foundational（CRITICAL：全ストーリーをブロック）
2. Phase 3 US1（認証境界）→ **STOP & VALIDATE**（S1）
3. Phase 4 US2（閲覧）→ 独立検証（S2）
4. Phase 5 US3（編集・削除・監査）→ 独立検証（S3）
5. ここまでで「管理者がデータを安全に閲覧・編集・削除できる」MVP が成立

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 → 検証 → デモ（安全境界）
3. US2 → 検証 → デモ（閲覧）
4. US3 → 検証 → デモ（CRUD + 監査 = 主機能 MVP）
5. US4（ダッシュボード）→ US5（監査ログ参照）を順次追加

---

## Notes

- [P] = 別ファイル・依存なし
- マイグレーションは本番直接 DDL 禁止・`set search_path = ''`・`(select auth.uid())` 包み（Constitution IV / sql.md）
- `is_admin()` の判定ミスは全データ露出に直結するため RLS テスト（T016）を厚く
- ソフトデリート導入の service-front 影響（T060）を忘れない
- コンポーネントは 1 フォルダ構成 + `/generate-with-tests`（Constitution III / CLAUDE.md）
- 各チェックポイントでストーリー単位の独立検証を行う
- 用語は「**ソフトデリート（論理削除 / `deleted_at`）**」に統一する（spec FR-013 の「非公開化」は本機能では論理削除を指す。`dives.is_public` による公開可否とは別概念）
- 管理者管理 UI は MVP 外（seed 運用）。MVP の編集対象 Server Action は dive-sites（T051）/ dives（T052）/ 汎用エディタ（T057）であり、users は T057 経由
