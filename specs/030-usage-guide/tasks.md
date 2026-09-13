# Tasks: アプリの使い方ページ

**Input**: Design documents from `/specs/030-usage-guide/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/guide-page.md, quickstart.md

**Tests**: Constitution III（Test-First・テスト同梱）に従い、コンポーネント実装前にテストを書く。

**Organization**: ユーザーストーリー単位でフェーズ分割し、各ストーリーを独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（異なるファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2 / US3）
- パスはリポジトリルートからの相対パス

## Phase 1: Setup

**Purpose**: ベースブランチの鮮度確保と環境検証（plan.md「実装上の注意」）

- [X] T001 ワークツリーブランチ `worktree-030-usage-guide` に最新 main を取り込む（実際の最新統合ブランチは `develop` だったため `git merge develop` を実行。CLAUDE.md の SPECKIT マーカーのコンフリクトを解消）
- [X] T002 取り込み後のベースラインを検証する（node_modules はメインリポジトリへの symlink で解決 → biome クリーン → tsc OK → Vitest unit プロジェクト全パス。storybook browser プロジェクトはワークツリーの symlink 制約で実行不可のため対象外）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ストーリーが依存するコンテンツ構造（型・セクション定義・feature 公開 API）

**⚠️ CRITICAL**: このフェーズ完了までユーザーストーリーの実装に着手しない

- [X] T003 `GuideSection` / `GuideStep` / `GuideLink` 型を service-front/src/features/guide/types.ts に作成する（data-model.md のフィールド定義・JSDoc コメント付き）
- [X] T004 `PAGE_DATA`（slug `/guide`・title「使い方」・description）と `GUIDE_SECTIONS`（6 セクション: `getting-started` / `dive-logs` / `plans-packing` / `dashboard` / `social-likes` / `log-credits` の title・description・steps・links の本文）を service-front/src/features/guide/constants.ts に作成する（T003 依存。data-model.md のセクション定義表に従う。`getting-started` の links に `/signup`（requiresAuth: false）を含める）
- [X] T005 feature 公開 API を service-front/src/features/guide/index.ts に作成する（型・`PAGE_DATA`・`GUIDE_SECTIONS` を再 export。`GuideView` は US1 実装時に追記）

**Checkpoint**: コンテンツ構造が確定 — ユーザーストーリー実装を開始できる

---

## Phase 3: User Story 1 - 新規ユーザーが最初のログ作成までの流れを学ぶ (Priority: P1) 🎯 MVP

**Goal**: `/guide` ページ本体（6 セクション・番号付きステップ・機能導線・例示表示）とヘッダー / フッターからの導線を提供する

**Independent Test**: ログイン済みユーザーがヘッダーまたはフッターの「使い方」から `/guide` を開き、「はじめに」の案内に沿ってログ作成画面（`/dives/new`）へ到達できる（quickstart.md 手順 2・4・6）

### Tests for User Story 1（実装前に書き、FAIL を確認する）⚠️

- [X] T006 [P] [US1] `GuideSectionCard` の Vitest テストを service-front/src/features/guide/components/GuideSectionCard/GuideSectionCard.test.tsx に作成する（`section` が `aria-labelledby` で h2 と関連付く / h2 が `id` を持つ / 手順が `<ol>` で番号付き表示される / links がリンクとして描画される / `example` slot が描画される）
- [X] T007 [P] [US1] `GuideView` の Vitest テストを service-front/src/features/guide/components/GuideView/GuideView.test.tsx に作成する（h1「使い方」が 1 つ / `GUIDE_SECTIONS` の 6 セクションがすべて描画される / `examples` prop で渡した ReactNode が該当セクションに注入される）

### Implementation for User Story 1

- [X] T008 [US1] `GuideSectionCard` を service-front/src/features/guide/components/GuideSectionCard/GuideSectionCard.tsx + index.ts に実装する（Server Component・contracts/guide-page.md のページ構造契約に従う。T006 がパスすること）
- [X] T009 [US1] `GuideSectionCard.stories.tsx` を同フォルダに作成する（例示 slot あり / なしの 2 story）
- [X] T010 [US1] `GuideView` を service-front/src/features/guide/components/GuideView/GuideView.tsx + index.ts に実装し、features/guide/index.ts に `GuideView` の export を追加する（h1 + GUIDE_SECTIONS を `GuideSectionCard` で描画・`examples?: Record<string, ReactNode>` を受け取る。T007 がパスすること）
- [X] T011 [US1] `GuideView.stories.tsx` を同フォルダに作成する
- [X] T012 [US1] ルートページを service-front/src/app/(public)/guide/page.tsx に作成する（`generatePageMetadata(PAGE_DATA)`・**noIndex なし** / 表示専用の例示コンポーネントをサンプルデータで組み立てて `GuideView` に注入する。候補は research.md Decision 4 — 予定カード・統計カード等。Server Action・`'use client'` 操作系を含むものは注入しないことを確認する）
- [X] T013 [P] [US1] ヘッダーのメインナビゲーション（デスクトップ + モバイルメニュー）に「使い方」→ `/guide` を追加し、既存の Header テストを同期更新する（service-front/src/shared/components/layout/Header/ 配下。T001 取り込み後の実体に合わせる）
- [X] T014 [P] [US1] フッターの `FOOTER_LINKS` に `{ href: '/guide', label: '使い方' }` を追加し、既存の Footer テストを同期更新する（service-front/src/shared/components/layout/Footer/ 配下）

**Checkpoint**: ログイン済みユーザーが導線から `/guide` を開き、全セクションと機能導線を利用できる（MVP）

---

## Phase 4: User Story 2 - 未登録の訪問者がアプリでできることを理解する (Priority: P2)

**Goal**: 未ログインでの閲覧（リダイレクトなし）・登録導線・検索インデックス許可を保証する

**Independent Test**: シークレットウィンドウで `/guide` にアクセスして全セクションを閲覧でき、登録導線から `/signup` に遷移できる（quickstart.md 手順 1・5・8）

### Tests for User Story 2（実装前に書き、FAIL を確認する）⚠️

- [X] T015 [US2] a11y / E2E テストを service-front/tests/a11y/guide.spec.ts に作成する（未ログインで `/guide` が 200 表示（リダイレクトなし）/ axe-core 違反 0 件 / 登録導線クリックで `/signup` に遷移 / `robots` メタに `noindex` が含まれない）

### Implementation for User Story 2

- [X] T016 [US2] ページ末尾に未登録者向け登録 CTA（「無料で始める」→ `/signup`）を `GuideView` に追加し、GuideView.test.tsx に検証を追加する（service-front/src/features/guide/components/GuideView/。FR-005。`getting-started` の links の `/signup` は T004 で定義済み）
- [X] T017 [US2] proxy.ts に `/guide` が認証ガード対象として**追加されていない**ことを確認し、T015 の全テストがパスすることを確認する（service-front/src/proxy.ts は変更しない — contracts/guide-page.md のルート契約）

**Checkpoint**: 未ログインで全コンテンツ閲覧・登録導線・インデックス許可が検証済み

---

## Phase 5: User Story 3 - 既存ユーザーが特定機能の使い方を調べる (Priority: P3)

**Goal**: 目次（ページ内アンカーナビ）と「目次に戻る」導線で、目的セクションへ直接移動できるようにする

**Independent Test**: 目次から任意のセクションを選択して該当セクション先頭へ移動し、「目次に戻る」で目次に戻れる（quickstart.md 手順 3）

### Tests for User Story 3（実装前に書き、FAIL を確認する）⚠️

- [X] T018 [US3] 目次の検証を service-front/src/features/guide/components/GuideView/GuideView.test.tsx に追加する（`<nav aria-label="目次">` が存在 / 6 セクションすべてのアンカーリンク（`href="#<id>"`）がある / 各リンクの href が対応する h2 の `id` と一致する）

### Implementation for User Story 3

- [X] T019 [US3] `GuideView` にページ先頭の目次 nav と各セクション末尾の「目次に戻る」導線（`#guide-toc` アンカー）を実装する（service-front/src/features/guide/components/GuideView/GuideView.tsx。JS 不要のアンカーのみ・research.md Decision 3。T018 がパスすること。stories も同期更新）
- [X] T020 [US3] service-front/tests/a11y/guide.spec.ts に目次アンカーの動作検証を追加する（目次リンククリックで URL ハッシュが変化し該当セクションが表示される / キーボード（Tab + Enter）でも操作できる）

**Checkpoint**: 全ストーリーが独立して機能する

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T021 [P] 全体検証を実行する（`npx biome check service-front/src` → `npx tsc --noEmit`（service-front）→ 全 Vitest → Playwright a11y。すべてグリーンであること）
- [X] T022 quickstart.md の手動検証 9 手順を実施し、モバイル幅 375px での横スクロールなし（SC-004）とログイン済み / 未ログイン両方の表示（FR-001）を確認する
- [X] T023 [P] `/sync-spec specs/030-usage-guide` を実行し、実装と spec.md / plan.md / data-model.md のずれ（セクション本文・例示コンポーネントの最終選定等）を仕様書側に反映する
- [X] T024 コミットを整理し PR を作成する（`feat(030): アプリの使い方ページを追加`。`/summary` でディスクリプション生成・`/review` で最終チェック）

---

## Phase 7: 追加対応（レビュー後の要望）

- [X] T025 TOP ダッシュボード末尾に使い方の導入セクション `GuideIntroSection` を追加する（FR-011。service-front/src/features/guide/components/GuideIntroSection/ + src/app/page.tsx。見出し「使い方ガイド」+ 紹介文（PAGE_DATA.description 流用）+ 「使い方を見る」→ /guide。テスト・story 同梱）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。最初に実行（T001 → T002）
- **Foundational (Phase 2)**: Phase 1 完了後。T003 → T004 → T005 の順（全ストーリーをブロック）
- **User Stories (Phase 3–5)**: Phase 2 完了後。優先度順（US1 → US2 → US3)を推奨。US2 / US3 は US1 の `GuideView` に依存するため、完全並列にはできない（下記参照）
- **Polish (Phase 6)**: 全ストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Phase 2 のみに依存。単独で MVP として成立
- **US2 (P2)**: T016 が US1 の `GuideView`（T010）に依存。T015（テスト作成）は US1 完了を待たず並行着手可
- **US3 (P3)**: T018–T019 が US1 の `GuideView`（T010）に依存

### Within Each User Story

- テストを先に書き、FAIL を確認してから実装する（Constitution III）
- コンポーネント → ページ → ナビ導線の順
- 各 Checkpoint で独立検証してから次のストーリーへ

### Parallel Opportunities

- T006 と T007（US1 のテスト 2 本・別ファイル)
- T013 と T014（Header / Footer・別ファイル）。T008–T012 とも並列可
- T015（US2 テスト）は US1 実装中に並行して書ける
- T021 と T023（検証と仕様書同期・別対象）

## Parallel Example: User Story 1

```bash
# テストを並列で作成（実装前・FAIL 確認）:
Task: "GuideSectionCard の Vitest テストを GuideSectionCard.test.tsx に作成"
Task: "GuideView の Vitest テストを GuideView.test.tsx に作成"

# ナビ導線を並列で追加（コンポーネント実装と独立）:
Task: "Header に「使い方」リンクを追加しテスト同期"
Task: "Footer の FOOTER_LINKS に「使い方」を追加しテスト同期"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1（main 取り込み）→ Phase 2（コンテンツ構造）を完了する
2. Phase 3（US1）を完了し、ログイン済みユーザーで `/guide` を独立検証する
3. この時点でデプロイ可能な MVP（ページ本体 + 導線）

### Incremental Delivery

1. US1 → 検証 → MVP としてリリース可能
2. US2 追加 → 未ログイン閲覧・登録導線・インデックスを検証（公開ページ化の完成)
3. US3 追加 → 目次で探索性を強化
4. Polish → 全体検証・仕様書同期・PR

## Notes

- 例示コンポーネントの最終選定（T012）は表示専用性の確認が必須（research.md Decision 4）
- Header / Footer は T001 の main 取り込み後の実体（モバイルメニューの有無・`Heading` の存在）に合わせて調整する
- 各タスク完了ごと、または論理的なまとまりごとにコミットする（Conventional Commits）
