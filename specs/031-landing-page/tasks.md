# Tasks: ランディングページ（LP）

**Input**: Design documents from `/specs/031-landing-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md, quickstart.md

**Tests**: constitution III（Test-First・テスト同梱）により、`features/landing/components/**` の各コンポーネントは Vitest 単体テスト + Storybook story を同梱必須。ページ全体は Playwright + axe-core で検証する。

**Organization**: ユーザーストーリー単位でフェーズを分割し、各ストーリーが独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2 / US3）
- パスはすべてリポジトリルートからの相対パス

## Phase 1: Setup

**Purpose**: feature フォルダと素材置き場の初期化

- [X] T001 `service-front/src/features/landing/` と `service-front/src/app/(public)/lp/` のディレクトリを作成し、`service-front/src/features/landing/index.ts`（空の再 export）を置く
- [X] T002 [P] LP 用スクリーンショット素材 4 点を `service-front/public/lp/`（`dashboard.png` / `dive-log.png` / `plans.png` / `timeline.png`）に配置する。実画面の撮影が間に合わない場合は同名の仮画像（サイズ・アスペクト比は本番想定 1200×750 程度）を置き、差し替えを Phase 6 T015 で行う

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全コンポーネントが参照するコンテンツ定義。**これが終わるまでユーザーストーリーの実装に着手しない**

- [X] T003 `service-front/src/features/landing/constants.ts` を作成: `PAGE_DATA`（slug: `/lp`・title・description。`PageMetadata` 型に準拠）、キャッチコピー等のヒーロー用コピー、`LandingFeature` interface（title / description / imageSrc / imageAlt）と機能紹介 4 件（ログ記録・統計ダッシュボード・予定管理・タイムライン共有。imageSrc は `/lp/*.png`、imageAlt は内容を説明する文）を定義し、`index.ts` から再 export する（data-model.md 参照）

**Checkpoint**: コンテンツ定義完了 — 各セクションコンポーネントを並列で実装可能

---

## Phase 3: User Story 1 - 未認証の訪問者がサービスを理解して新規登録に進む (Priority: P1) 🎯 MVP

**Goal**: `/lp` で LP が表示され、ヒーロー → 機能紹介（画像付き）→ 料金 → 最下部 CTA の構成で `/signup` へ誘導できる

**Independent Test**: 未ログインで `http://localhost:3000/lp` を開き、リダイレクトされずに全セクションが表示され、CTA から `/signup` に遷移できる（quickstart.md シナリオ 1）

> **NOTE**: constitution III に従い、各コンポーネントはテストを先に書く（または `/generate-with-tests` で本体作成直後に同梱生成する）。フォルダ構成は `rules/folder-structure.md`（本体 + .test.tsx + .stories.tsx + index.ts）に従う。

### Implementation for User Story 1

- [X] T004 [P] [US1] `LandingHero` を `service-front/src/features/landing/components/server/LandingHero/` に作成: `h1` のキャッチコピー・説明文・`/signup` への主要 CTA（`next/link`・44×44px 以上）・`/login` へのテキストリンク（FR-003 / FR-007）。Vitest テスト（見出しレベル 1・CTA の href）+ Storybook story を同梱
- [X] T005 [P] [US1] `LandingFeatures` を `service-front/src/features/landing/components/server/LandingFeatures/` に作成: constants の 4 機能を `h2` セクション + `next/image`（alt 必須・ファーストビュー外は遅延読み込み）で表示（FR-004 / FR-004a）。テスト（4 件の描画・img alt）+ story を同梱
- [X] T006 [P] [US1] `LandingPricing` を `service-front/src/features/landing/components/server/LandingPricing/` に作成: props（`packQuantity` / `packAmountJpy` / `initialGrantAmount` / `dailyBonusAmount`）を受け取り「基本無料（初期 N 枠 + 毎日 +N 枠）/ ログパック N 枠 N 円」を表示（FR-005。**価格のハードコード禁止**、data-model.md の LandingPricingProps 参照）。テスト（props の値が表示に反映されること）+ story を同梱
- [X] T007 [P] [US1] `LandingCta` を `service-front/src/features/landing/components/server/LandingCta/` に作成: 最下部の登録 CTA（`/signup`）と一言コピー（FR-006）。テスト + story を同梱
- [X] T008 [US1] `service-front/src/features/landing/index.ts` から 4 コンポーネントと `PAGE_DATA` を再 export する（T004〜T007 完了後）
- [X] T009 [US1] `service-front/src/app/(public)/lp/page.tsx` を作成: `generatePageMetadata(PAGE_DATA)` を export（noIndex なし）、`features/credits` の `LOG_CREDIT_PACK` / `INITIAL_GRANT_AMOUNT` / `DAILY_BONUS_AMOUNT` を読み取り `LandingPricing` に注入（feature 間 import 回避 / research.md Decision 3）、Hero → Features → Pricing → Cta の順に組み立てる。`'use client'` を使わない
- [X] T010 [US1] Playwright + axe-core テストを `service-front/tests/landing.spec.ts` に作成: 未認証で `/lp` が 200 で表示・`h1` が 1 つ・ヒーロー CTA が `/signup` に遷移・axe の重大違反 0 件（SC-006）

**Checkpoint**: US1 単独で MVP として動作（未認証で LP 閲覧 → 登録導線）

---

## Phase 4: User Story 2 - 既存の画面遷移に影響を与えない (Priority: P2)

**Goal**: LP 追加後もトップ URL・認証まわりの挙動が従来どおりで、認証済みユーザーも `/lp` を閲覧できる

**Independent Test**: quickstart.md シナリオ 2（`/` 未認証 → `/login`、認証済み → ダッシュボード、認証済みで `/lp` 閲覧可）

### Implementation for User Story 2

- [X] T011 [US2] `service-front/tests/landing.spec.ts` に退行防止テストを追加: 未認証で `/` → `/login` リダイレクト・認証済み状態で `/lp` が 200 で表示されリダイレクトされないこと（contracts/routes.md の不変条件）。あわせて `git diff` で `service-front/src/proxy.ts` に変更が入っていないことを確認する（変更していたら設計違反として差し戻す）

**Checkpoint**: US1 + US2 が同時に成立（新導線の追加と既存挙動の維持）

---

## Phase 5: User Story 3 - 検索・SNS 経由の流入で正しく内容が伝わる (Priority: P3)

**Goal**: メタ情報（OG / Twitter / canonical / sitemap）が設定され、モバイル幅でも崩れない

**Independent Test**: quickstart.md シナリオ 3・4（meta タグの出力確認・375px 幅で横スクロールなし）

### Implementation for User Story 3

- [X] T012 [P] [US3] `service-front/src/app/sitemap.ts` に `features/landing` の `PAGE_DATA` を 1 エントリ追加する（既存の terms / privacy-policy と同じパターン。FR-009）
- [X] T013 [P] [US3] `service-front/tests/landing.spec.ts` に metadata 検証を追加: `/lp` の HTML に `og:title` / `og:description` / `og:image` / `twitter:card` / canonical `/lp` が含まれ、`noindex` が**含まれない**こと（FR-009）
- [X] T014 [US3] `service-front/tests/landing.spec.ts` にモバイル検証を追加: viewport 375×667 で横スクロールが発生しない（`document.documentElement.scrollWidth <= 375`）・主要 CTA のタップ領域が 44×44px 以上（FR-010）

**Checkpoint**: 全ユーザーストーリーが独立して検証可能

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 T002 で仮画像を使った場合、開発環境（シードデータ）で実画面のスクリーンショットを撮影し `service-front/public/lp/` の 4 点を差し替える。alt 文言が実際の画像内容と一致しているか確認する（research.md Decision 5）
- [X] T016 全テスト実行と lint: `npx vitest run src/features/landing`（cwd: `service-front`。worktree の場合は quickstart.md の node_modules 注意を参照）・Playwright `tests/landing.spec.ts`・`npx biome check .`（指摘があれば `--write` で修正）
- [X] T017 quickstart.md の手動検証 4 シナリオを実施し、`/sync-spec specs/031-landing-page` で spec と実装のずれ（コピー文言・セクション構成・価格表示）を最終確認する

---

## 実装メモ（031 実装セッション / 2026-07-10）

T001〜T017 まで全タスク完了。稼働中のローカル Supabase を再利用して Playwright と実スクショ撮影まで実施した。

**完了した検証（このセッションで実行済み・すべて green）**
- `npx tsc --noEmit`: エラー 0
- `npx biome check`（新規・変更ファイル）: クリーン
- `npx vitest run --project unit`: 全体 1211 passed / 10 skipped（landing の単体 9 件を含む・回帰なし）
- `npx playwright test tests/landing.spec.ts`: **8 passed**（表示・CTA 遷移・退行防止・metadata・sitemap・モバイル・axe）
- `git status` で `service-front/src/proxy.ts` 無変更を確認（T011 の設計不変条件）
- spec ↔ 実装の整合を確認（価格 10 枠 300 円・`/lp` 認証不要・noIndex なし。T017）

**a11y 修正（Playwright の axe が検出）**: `LandingPricing` のおすすめカードが `bg-primary/5`（着色背景）+ `text-muted-foreground` でコントラスト 4.27:1（AA 未達）だった。背景の着色をやめ `border-2 border-primary/50` のアクセントに変更して 4.5:1 を満たすよう修正済み。

**T015 の実スクショ**: 稼働中の dev + Supabase（seed ユーザー `test@example.com`）から使い捨て Playwright spec で 4 枚を 1200×750 で撮影し `public/lp/` を実画面に差し替えた（撮影 spec は削除済み）。
- `dashboard.png` ← `/`（統計・グラフ）
- `dive-log.png` ← `/dives/new`（入力画面）
- `plans.png` ← `/plans`（予定一覧）
- `timeline.png` ← `/` の「最近のダイブログ」フィード（seed にフォロー先が無くソーシャルタイムラインは空状態のため、時系列のログフィードで代替）。**マーケ用に仕上げた画像への差し替えは将来のデザインタスク**

**worktree の注意**: `node_modules` はメインリポジトリへの symlink で解決した（vitest は cwd=`service-front`、`--project unit` で実行）。`.env` はメインリポジトリからコピー（gitignore 済み）。Storybook のブラウザモード（`|storybook|` プロジェクト）は symlink 越しに addon セットアップを取得できず失敗するが、これは環境要因で story 自体の問題ではない。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 依存なし。T001 / T002 は並列可
- **Phase 2 (Foundational)**: T001 完了後。**T003 が全ストーリーをブロック**
- **Phase 3 (US1)**: T003 完了後。T004〜T007 は並列可 → T008 → T009 → T010
- **Phase 4 (US2)**: T010 のテストファイルに追記するため T010 完了後が安全（検証観点自体は US1 と独立）
- **Phase 5 (US3)**: T012 は T003 完了後いつでも可。T013 / T014 は T009・T010 完了後
- **Phase 6 (Polish)**: 全ストーリー完了後

### Parallel Opportunities

- T001 と T002（Setup 内）
- T004 / T005 / T006 / T007（セクションコンポーネント 4 つ — 別フォルダ・相互依存なし）
- T012 は US1 実装と並行可能（sitemap は constants にのみ依存）

## Parallel Example: User Story 1

```bash
# T003 完了後、4 セクションを並列実装（それぞれテスト + story 同梱）:
Task: "LandingHero を service-front/src/features/landing/components/server/LandingHero/ に作成"
Task: "LandingFeatures を service-front/src/features/landing/components/server/LandingFeatures/ に作成"
Task: "LandingPricing を service-front/src/features/landing/components/server/LandingPricing/ に作成"
Task: "LandingCta を service-front/src/features/landing/components/server/LandingCta/ に作成"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 → Phase 2（T003 のコンテンツ定義が土台）
2. Phase 3 完了で `/lp` が動く MVP（未認証で閲覧 → `/signup` 導線）
3. **STOP and VALIDATE**: quickstart.md シナリオ 1 で単独検証

### Incremental Delivery

1. US1 → MVP デモ可能（LP 単体）
2. US2 → 退行なしを保証してリリース可能ライン到達
3. US3 → SEO / モバイル品質を積み増し
4. Polish → 実素材差し替え・全テスト・仕様同期で完成

## Notes

- LP は Server Components のみ（`'use client'` 禁止 / research.md Decision 8）
- 見出しは素の `h1`/`h2` + Tailwind（`Heading` コンポーネントは develop 未マージのため使わない / Decision 7）
- 価格・枠数は `features/credits` の定数を app 層（`page.tsx`）で注入。コンポーネント・constants へのハードコード禁止
- 各タスク（または論理グループ）ごとにコミットする（Conventional Commits）
