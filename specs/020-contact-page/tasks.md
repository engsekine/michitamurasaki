---

description: "Task list for お問い合わせページ implementation"
---

# Tasks: お問い合わせページ

**Input**: Design documents from `specs/020-contact-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/（すべて作成済み）

**Tests**: 含む（Constitution III「Test-First」/ `src/**/components/**` は Vitest・Storybook・Playwright(a11y) を同梱）。

**Organization**: User Story 単位でフェーズ化し、各ストーリーを独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（別ファイル・依存なし）
- **[Story]**: 対応する User Story（US1/US2/US3）
- 各タスクに対象ファイルの絶対/相対パスを明記

## Path Conventions

- service-front（公開フォーム）: `service-front/src/...`
- admin-front（運営閲覧）: `admin-front/src/...`
- DB: `supabase/migrations/...` / 生成型: `packages/supabase/src/database.types.ts`

---

## Phase 1: Setup（共有の足場）

**Purpose**: 両 feature のフォルダ骨格と共有定数を用意する

- [X] T001 [P] service-front の feature 骨格を作成: `service-front/src/features/contact/index.ts`（PAGE_DATA・公開 export のプレースホルダ）
- [X] T002 [P] 問い合わせ種別・本文上限・レート制限しきい値を一元定義: `service-front/src/features/contact/constants.ts`（`INQUIRY_CATEGORIES`=question/bug/request/other とラベル、`BODY_MAX_LENGTH=1000`、`RATE_LIMIT`={windowSec:60,maxCount:3,dupWindowSec:300}、`PAGE_DATA`）
- [X] T003 [P] admin-front の feature 骨格を作成: `admin-front/src/features/inquiries-admin/index.ts` と種別ラベル定数 `admin-front/src/features/inquiries-admin/constants.ts`（key→日本語ラベル）

---

## Phase 2: Foundational（ブロッキング前提）

**Purpose**: DB スキーマ・関数・RLS・生成型。全ストーリーの前提

**⚠️ CRITICAL**: 本フェーズ完了まで US1/US2/US3 の実装は開始できない

- [X] T004 マイグレーション作成（テーブル本体）: `supabase/migrations/20260629110000_create_inquiries.sql` に `public.inquiries`（id/name/email/category/body/submitter_user_id/submitter_ip/created_at、CHECK 制約・FK `on delete set null`・comment）を定義（data-model.md）
- [X] T005 同マイグレーションにインデックス追加: `idx_inquiries_created_at`、`idx_inquiries_ip_created_at`（同 `supabase/migrations/20260629110000_create_inquiries.sql`）
- [X] T006 同マイグレーションに `security definer` 関数 `public.submit_inquiry(p_name,p_email,p_category,p_body,p_submitter_user_id,p_submitter_ip)` を追加（`set search_path=''`、入力検証→レート制限→重複拒否→INSERT、`grant execute ... to anon, authenticated`）（contracts/contact-submit.md・data-model.md）
- [X] T007 同マイグレーションに RLS を追加: `enable row level security` + `admins read inquiries`(select) + `admins delete inquiries`(delete)（INSERT/UPDATE ポリシーは作らない / R-001）
- [X] T008 マイグレーション適用と生成型更新: `supabase db reset` 後に `supabase gen types typescript --local > packages/supabase/src/database.types.ts`（`inquiries`・`submit_inquiry` が型に出ることを確認 / R-007）

**Checkpoint**: DB とテーブル型が整い、フォーム送信・管理閲覧の実装を開始できる

---

## Phase 3: User Story 1 - 訪問者がお問い合わせを送信する (Priority: P1) 🎯 MVP

**Goal**: 公開 `/contact` から氏名・メール・種別・本文を送信し、`inquiries` に保存して受付完了を表示する（ハニーポット・レート制限・重複拒否込み）

**Independent Test**: 未ログインで `/contact` を開き必須入力→送信で受付完了が表示され DB に 1 行作成される。不備入力は各項目エラーで送信拒否、連投は拒否される（quickstart シナリオ 1）

### Tests for User Story 1 ⚠️（実装前に書き、失敗を確認）

- [X] T009 [P] [US1] yup スキーマのテスト: `service-front/src/features/contact/schemas/contact.schema.test.ts`（必須・メール形式・本文 1–1000・種別 oneOf・ハニーポット任意）
- [X] T010 [P] [US1] `ContactForm` の単体テスト: `service-front/src/features/contact/components/client/ContactForm/ContactForm.test.tsx`（バリデーション表示・送信中の無効化・成功時 reset と aria-live・失敗時 role="alert"）
- [X] T011 [P] [US1] `ContactForm` の Storybook story: `service-front/src/features/contact/components/client/ContactForm/ContactForm.stories.tsx`（初期/エラー/送信中/成功）
- [X] T012 [P] [US1] `/contact` の Playwright a11y テスト（axe-core）: `service-front` の e2e 配置規約に従い `/contact` のフォーム a11y を検証

### Implementation for User Story 1

- [X] T013 [P] [US1] yup スキーマ実装: `service-front/src/features/contact/schemas/contact.schema.ts`（`constants.ts` の選択肢・上限を参照、`website` ハニーポット項目を含む）
- [X] T014 [US1] Server Action `submitInquiry` 実装: `service-front/src/features/contact/server/actions.ts`（yup 再検証→ハニーポット判定→`auth.getUser()`→`headers()` で IP→`supabase.rpc('submit_inquiry', ...)`→`rate_limited`/`duplicate`/その他のエラーマッピング、`ActionResult` 返却）（contracts/contact-submit.md）
- [X] T015 [P] [US1] `ContactForm` クライアントコンポーネント実装: `service-front/src/features/contact/components/client/ContactForm/ContactForm.tsx`（RHF + yupResolver、`FormField`/`FormSelect`/`FormTextarea` 利用、送信中ボタン無効化、成功 aria-live・失敗 role="alert"、隠しハニーポット `website`）+ `index.ts`
- [X] T016 [US1] 公開ページ実装: `service-front/src/app/(public)/contact/page.tsx`（Server Component、`generatePageMetadata(PAGE_DATA)`、`Breadcrumbs`、空 defaultValues で `ContactForm` を描画）
- [X] T017 [US1] feature の公開 export を確定: `service-front/src/features/contact/index.ts`（`PAGE_DATA`・`ContactForm` 等を re-export）
- [X] T018 [US1] フッター導線追加（FR-016）: `service-front/src/shared/components/layout/Footer/Footer.tsx` の `FOOTER_LINKS` に `{ href: '/contact', label: 'お問い合わせ' }` を追加し、`Footer.test.tsx` を同期更新

### 確認画面・完了（サンクス）ページ（FR-019 / FR-020）

- [X] T036 [US1] 定数追加: `service-front/src/features/contact/constants.ts` に `COMPLETE_PAGE_DATA`・`CONTACT_COMPLETE_PATH`・`inquiryCategoryLabel`（値→ラベル）を追加し、`index.ts` から `COMPLETE_PAGE_DATA` を re-export
- [X] T037 [US1] `ContactForm` を入力⇄確認の 2 ステップ化（FR-019）: 「確認画面へ進む」で検証通過後に確認表示（種別はラベル・本文は `whitespace-pre-wrap`）、「入力内容を修正する」で値を保持して戻る、確認画面で「送信する」→ 成功時 `router.push('/contact/complete')`・失敗時は確認画面に `role="alert"`。`ContactForm.test.tsx` を新フローへ同期
- [X] T038 [US1] 完了（サンクス）ページ実装（FR-020）: `service-front/src/app/(public)/contact/complete/page.tsx`（Server Component、`generatePageMetadata(COMPLETE_PAGE_DATA)`、受付メッセージ + ホーム等への導線）

### 通知メール（運営通知 + 自動返信・厳密通知 / FR-021〜023）

- [X] T039 取り消し関数のマイグレーション: `supabase/migrations/20260629120000_add_discard_recent_inquiry.sql`（`discard_recent_inquiry(p_id)` = 直近 2 分の当該 id を削除・security definer・anon/authenticated に grant）→ 適用 + `supabase gen types` で型再生成
- [X] T040 resend 依存追加: `service-front` に `resend` を追加（旧 `nodemailer` / `@types/nodemailer` は削除）
- [X] T041 [P] [US1] メール送信モジュール実装: `service-front/src/features/contact/server/email.ts`（`sendInquiryNotifications`＝運営通知 + 送信者自動返信の 2 通、Resend HTTP API、`emails.send` の `error` を検査して throw、必須 env 欠如でも throw）+ `email.test.ts`（resend をモック）
- [X] T042 [US1] Server Action を厳密通知に更新: `service-front/src/features/contact/server/actions.ts`（保存成功 → `sendInquiryNotifications` → 失敗時 `discard_recent_inquiry` で取り消して `actionFailure`）（contracts/contact-submit.md）
- [ ] T043 環境変数の用意（手動）: `RESEND_API_KEY` / `CONTACT_MAIL_FROM` / `CONTACT_NOTIFY_TO` を service-front の `.env`（本番は各環境）に設定。Resend でドメイン認証（SPF/DKIM）を行う

**Checkpoint**: `/contact` で 入力 → 確認 → 送信（保存 + 通知メール 2 通）→ `/contact/complete`。メール失敗時は取り消して確認画面でエラー

---

## Phase 4: User Story 2 - 運営者が届いたお問い合わせを確認する (Priority: P2)

**Goal**: admin-front に「お問い合わせ」一覧・詳細を追加し、受付日時降順で閲覧・検索でき、不要なものを物理削除（監査ログ付き）できる

**Independent Test**: 管理者でログインしナビ「お問い合わせ」→ 一覧（新しい順・検索）→ 詳細表示 → 削除で一覧から消え `admin_audit_logs` に `hard_delete` が残る。非管理者は閲覧拒否（quickstart シナリオ 2〜4）

### Tests for User Story 2 ⚠️

- [X] T019 [P] [US2] `DeleteInquiryButton` の単体テスト: `admin-front/src/features/inquiries-admin/components/client/DeleteInquiryButton/DeleteInquiryButton.test.tsx`（確認操作・呼び出し・失敗時のエラー表示）
- [X] T020 [P] [US2] queries のテスト: `admin-front/src/features/inquiries-admin/server/queries.test.ts`（`listResource` 呼び出しパラメータ＝検索列/ソート列/hasDeletedAt=false、未認証で `requireAdmin` が拒否することをモックで検証）

### Implementation for User Story 2

- [X] T021 [P] [US2] queries 実装: `admin-front/src/features/inquiries-admin/server/queries.ts`（`listInquiries`=requireAdmin+`listResource('inquiries', 'id, name, email, category, created_at', {searchColumns:['name','email'], sortableColumns:['created_at'], hasDeletedAt:false})`、`getInquiryDetail`=本文含む全列を maybeSingle、型は `@repo/supabase` から導出）（contracts/admin-inquiries.md）
- [X] T022 [P] [US2] action 実装: `admin-front/src/features/inquiries-admin/server/actions.ts`（`deleteInquiry`=requireAdmin+`hardDeleteRow(supabase,'inquiries',id,admin.id,0)`+`revalidatePath('/inquiries')`、`mapMutationError`）
- [X] T023 [P] [US2] `DeleteInquiryButton` クライアントコンポーネント実装: `admin-front/src/features/inquiries-admin/components/client/DeleteInquiryButton/DeleteInquiryButton.tsx` + `index.ts`（確認ダイアログ→`deleteInquiry`）
- [X] T024 [US2] 一覧ページ実装: `admin-front/src/app/(admin)/inquiries/page.tsx`（`listInquiries`、表＝受付日時降順・氏名・メール・種別ラベル、検索・ページャ、0 件は「お問い合わせはありません」）
- [X] T025 [US2] 詳細ページ実装: `admin-front/src/app/(admin)/inquiries/[id]/page.tsx`（`getInquiryDetail`、氏名/メール/種別/本文/受付日時/送信元IP を自動エスケープで表示、`DeleteInquiryButton`、該当なしは not found）
- [X] T026 [US2] ナビ追加: `admin-front/src/shared/components/layout/AdminShell/AdminSidebar.tsx` の `NAV_ITEMS` に `{ href: '/inquiries', label: 'お問い合わせ' }` を追加
- [X] T027 [US2] feature export 確定: `admin-front/src/features/inquiries-admin/index.ts`

**Checkpoint**: US1 と US2 が独立して機能（送信 → 運営閲覧・削除）

---

## Phase 5: User Story 3 - ログイン中ユーザーは入力が補完される (Priority: P3)

**Goal**: ログイン中に `/contact` を開くと氏名・メールが初期表示され、編集して送信できる

**Independent Test**: ログイン状態で `/contact` を開くと氏名・メールが自分のアカウント情報で初期表示され、編集→送信で編集後の値が保存される（quickstart シナリオ 5）

### Tests for User Story 3 ⚠️

- [X] T028 [P] [US3] 初期値生成 lib のテスト: `service-front/src/features/contact/lib/prefill.test.ts`（user_details + email から `name`/`email` 初期値、未ログインは空）

### Implementation for User Story 3

- [X] T029 [P] [US3] 初期値生成 lib 実装: `service-front/src/features/contact/lib/prefill.ts`（`last_name`+`first_name` 結合・email を組み立て、null セーフ）+ `index.ts` から export
- [X] T030 [US3] `/contact` ページに補完を組み込み: `service-front/src/app/(public)/contact/page.tsx` で `auth.getUser()` とログイン時の `user_details` 取得 → `prefill` 値を `ContactForm` の `defaultValues` に渡す（未ログインは空のまま）
- [X] T031 [US3] `ContactForm` の `defaultValues` 受け取りと初期表示を確認・必要なら調整: `service-front/src/features/contact/components/client/ContactForm/ContactForm.tsx`（T010 のテストに初期値ケースを追加）

**Checkpoint**: 3 ストーリーすべてが独立して機能

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全体整合・検証

- [X] T032 DB の CHECK 制約と yup の上限・選択肢が同値であることを突き合わせ確認（`constants.ts` ↔ `contact.schema.ts` ↔ `20260629110000_create_inquiries.sql`）
- [ ] T033 quickstart.md のシナリオ 1〜6 を手動実行して受け入れ確認（service-front + admin-front + ローカル Supabase）
- [X] T034 `/sync-spec specs/020-contact-page` で実装と仕様のズレを確認し、必要なら spec/data-model を実装に合わせて更新
- [X] T035 `/review 020-contact-page` で差分の総合チェック（typo・表記ゆれ・影響範囲・a11y）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。即着手可
- **Foundational (Phase 2)**: Setup 完了に依存。全 US をブロック（T004→T005→T006→T007 は同一ファイルのため順次、T008 はその後）
- **User Stories (Phase 3+)**: すべて Foundational 完了に依存
  - US1（P1）→ US2（P2）→ US3（P3）の優先順、または Foundational 後に並行
- **Polish (Phase 6)**: 対象の US 完了に依存

### User Story Dependencies

- **US1 (P1)**: Foundational 後に着手可。他ストーリー非依存
- **US2 (P2)**: Foundational 後に着手可。US1 とはテーブル経由のみで結合（US1 が無くても一覧 0 件で独立検証可）
- **US3 (P3)**: US1 のフォーム/ページに補完を足す拡張。US1 完了が前提

### Within Each User Story

- テストを先に書き、失敗を確認してから実装（Constitution III）
- スキーマ/定数 → Server Action/queries → コンポーネント → ページ の順
- 同一ファイルを触るタスクは [P] を付けない（例: T004〜T007 は同一マイグレーション）

### Parallel Opportunities

- T001/T002/T003（別ファイル）は並列可
- 各 US のテスト群（T009〜T012 / T019〜T020）は並列可
- T013 と T015（スキーマとフォームは別ファイル）は並列可。ただし T014（Action）は T013 完了後
- US1 と US2 は Foundational 後に別担当で並行可能（US3 は US1 後）

---

## Parallel Example: User Story 1

```bash
# US1 のテストをまとめて起票（実装前・失敗確認）:
Task: "contact.schema.test.ts（バリデーション）"
Task: "ContactForm.test.tsx（フォーム挙動）"
Task: "ContactForm.stories.tsx（状態）"
Task: "/contact の Playwright a11y"

# 実装の並列分:
Task: "contact.schema.ts（スキーマ）"
Task: "ContactForm.tsx（フォーム本体）"
```

---

## Implementation Strategy

### MVP First（User Story 1 のみ）

1. Phase 1: Setup を完了
2. Phase 2: Foundational を完了（DB・関数・RLS・型）
3. Phase 3: US1 を完了
4. **停止して検証**: `/contact` の送信〜受付〜保存を単独テスト
5. 問題なければデモ/デプロイ（MVP）

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 → 単独検証 → デモ（MVP: 公開フォーム送信）
3. US2 → 単独検証 → デモ（運営閲覧・削除）
4. US3 → 単独検証 → デモ（ログイン補完）

### Parallel Team Strategy

- 基盤（Phase 1+2）をチームで完了後、担当 A=US1 / 担当 B=US2 を並行。US3 は US1 完了後に着手

---

## Notes

- [P] = 別ファイル・依存なし。[Story] ラベルでトレーサビリティを確保
- マイグレーションは 1 ファイル（T004〜T007）。強い依存のため同一ファイルにまとめる（sql.md 例外）
- 書き込みは `submit_inquiry`（security definer）経由のみ。anon への直接 INSERT ポリシーは作らない
- 本文・氏名等は自動エスケープに委ね `dangerouslySetInnerHTML` を使わない（FR-015）
- 各タスク or 論理単位ごとにコミット。チェックポイントで独立検証
