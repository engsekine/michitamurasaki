---
description: "Task list for 017-cookie-consent implementation"
---

# Tasks: Cookie 同意バナー

**Input**: Design documents from `/specs/017-cookie-consent/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 含める。Constitution III（Test-First / テスト同梱）に従い、`features/consent/components` は Vitest 単体テスト・Storybook story・Playwright a11y テストを必須同梱とする。ユーティリティ・store は Vitest、受け入れシナリオは Playwright E2E で検証する。

**Organization**: spec.md のユーザーストーリー（US1〜US4）ごとにフェーズを分割。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: US1: 初回表示と同意/拒否 / US2: 永続化と再表示しない / US3: 非必須 Cookie の gating 枠組み / US4: 後から変更

## Path Conventions

- フロントエンド: `service-front/src/`（Feature-based。新規 `features/consent/`）
- DB / Supabase / マイグレーションは**なし**

## 前提

- `zustand` 利用可能（再表示シグナルの共有）
- 既存 `app/layout.tsx`（Server Component）と `shared/components/layout/Footer/Footer.tsx`（Server）に組み込む
- 参照ページ `/privacy-policy` は既存

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 構成準備と組み込み箇所の確認

- [X] T001 `service-front/src/features/consent/` のディレクトリ構成を作成し、`app/layout.tsx` / `Footer.tsx` の組み込み箇所（mount 位置）を確認する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存する同意ユーティリティと store

**⚠️ CRITICAL**: このフェーズ完了まで各ユーザーストーリーの実装には着手できない

- [X] T002 [P] cookie-consent ユーティリティの Vitest を作成 in `service-front/src/features/consent/lib/cookie-consent.test.ts`（`accepted`/`rejected`/未設定/破損値→null、`setCookieConsent` が Max-Age 365日・Path・SameSite を付与）。contracts/consent-util.md 準拠
- [X] T003 [P] `cookie-consent.ts` 実装 in `service-front/src/features/consent/lib/cookie-consent.ts`（`COOKIE_CONSENT_NAME` / `COOKIE_CONSENT_MAX_AGE_SECONDS`、`getCookieConsentClient` / `getCookieConsentServer` / `setCookieConsent`、破損値は null 正規化）
- [X] T004 [P] store の Vitest を作成 in `service-front/src/features/consent/lib/store.test.ts`（`openSettings`→`forcedOpen=true` / `close`→`false`）
- [X] T005 [P] `store.ts`（zustand）実装 in `service-front/src/features/consent/lib/store.ts`（`forcedOpen` / `openSettings` / `close`）

**Checkpoint**: 同意状態の読み書きと再表示シグナルが揃い、各ストーリーを開始できる

---

## Phase 3: User Story 1 - 初回表示と同意/拒否 (Priority: P1) 🎯 MVP

**Goal**: 全ページ共通の非ブロッキングバナーを表示し、「同意する」「拒否する」「ポリシーリンク」で操作できる

**Independent Test**: Cookie 未設定で任意ページを開くとバナーが表示され、背後を操作でき、「同意する」で記録され閉じる（quickstart シナリオ A 前半）

### Tests for User Story 1 ⚠️（実装前に書き、FAIL を確認）

- [X] T006 [P] [US1] `CookieConsentBanner` の Vitest in `service-front/src/features/consent/components/client/CookieConsentBanner/CookieConsentBanner.test.tsx`（`initialConsent` 別の表示/非表示、同意/拒否で `setCookieConsent` 呼び出し + 非表示、ポリシーリンクの href、`forcedOpen` での再表示）
- [X] T007 [P] [US1] `CookieConsentBanner` の Storybook story（未選択=表示 / 同意済み=非表示 / 強制再表示）
- [ ] T008 [P] [US1] Playwright a11y: バナー表示状態の WCAG 2.1 AA 違反ゼロ（非モーダル・キーボード操作）in `service-front/tests/a11y/cookie-consent.spec.ts`
- [ ] T009 [P] [US1] Playwright E2E: Cookie 未設定 → バナー表示 → 背後操作可 → 「同意する」で消える（quickstart シナリオ A 前半）
- [ ] T009a [P] [US1] Playwright E2E: ログイン済み状態（seed の `test@example.com` / `password123`）で `cookie-consent` を削除して認証必須ページ（例 `/dives`）を開くと、バナーが表示され「同意する」で記録・非表示になることを検証（FR-010 / G1 対応。未ログインは T009 でカバー。ログイン手順は `tests/a11y/dives-pages.spec.ts` を流用）

### Implementation for User Story 1

- [X] T010 [US1] `CookieConsentBanner` 実装 in `service-front/src/features/consent/components/client/CookieConsentBanner/CookieConsentBanner.tsx` + `index.ts`（非ブロッキング `role="region"` + `aria-label`、同意/拒否ボタン・ポリシーリンク、`setCookieConsent` 書き込み、`store.forcedOpen` 購読で再表示、閉じる✕なし、`prefers-reduced-motion` 抑制）。バナー配置は画面下部固定（`fixed bottom-0`）を既定とする。contracts/components.md 準拠
- [X] T011 [US1] `service-front/src/app/layout.tsx` を変更し、サーバーで `cookies().get(COOKIE_CONSENT_NAME)` を `getCookieConsentServer` で正規化して `<CookieConsentBanner initialConsent={...} />` を `<body>` 内に mount（ノーフラッシュ、FR-011）

**Checkpoint**: 全ページでバナーが表示・操作でき、同意/拒否が記録される

---

## Phase 4: User Story 2 - 永続化と再表示しない (Priority: P1)

**Goal**: 一度選んだら再訪問・遷移で再表示されず、有効期限切れで再表示される

**Independent Test**: 同意後にリロード・別ページ遷移してもバナーが出ない（ちらつきもない）。Cookie 削除で再表示（quickstart シナリオ A 後半 / E）

### Tests for User Story 2 ⚠️

- [ ] T012 [P] [US2] Playwright E2E: 同意後にリロード/別ページ遷移でバナー非表示・初回描画でちらつかない（SC-002 / FR-004 / FR-011）
- [ ] T013 [P] [US2] Playwright E2E: `cookie-consent` Cookie を削除（期限切れ相当）→ 再アクセスで再表示（FR-005 / quickstart シナリオ E）
- [ ] T013a [P] [US2] Playwright E2E: ログイン済みユーザーがバナーで「拒否する」を選んだ後も、認証セッション（必須 Cookie）が維持され `/dives` 配下に引き続きアクセスできることを検証（FR-008 / G2 対応）

### Implementation for User Story 2

> 永続化と再表示判定は Foundational（T003 の Max-Age）+ US1（T010/T011 の `initialConsent` 判定）で充足。本ストーリーは振る舞いの検証が中心で追加実装は無し。

- [X] T014 [US2] T002 の Vitest に「`setCookieConsent` の Max-Age が `COOKIE_CONSENT_MAX_AGE_SECONDS`（365日）である」ことの明示アサーションを含める（FR-005 の単体保証）

**Checkpoint**: 選択が永続化され、期限内は再表示されない

---

## Phase 5: User Story 3 - 非必須 Cookie の gating 枠組み (Priority: P1)

**Goal**: 「拒否/未選択」では非必須 Cookie を使わず、「同意」でのみ使う枠組みを用意する（現状対象ゼロ）

**Independent Test**: ダミーの被ゲート処理が「拒否/未選択」で走らず「同意」で走る。非必須 Cookie が 0 件（quickstart シナリオ C / SC-003）

### Tests for User Story 3 ⚠️

- [X] T015 [P] [US3] Vitest: `getCookieConsentClient()==='accepted'` を確認してから走るダミー被ゲート処理が、拒否/未設定では実行されず同意でのみ実行されることを検証 in `service-front/src/features/consent/lib/gating.test.ts`

### Implementation for User Story 3

- [X] T016 [US3] gating 規約の参照点とサンプルを用意 in `service-front/src/features/consent/lib/`（非必須ローダが `getCookieConsentClient()==='accepted'` を確認してから実行する規約を明示。gating の参照点は関数 `getCookieConsentClient()` とし、サンプルは JSDoc + 使用例コメントで示す。現状非必須 Cookie は無いため実体は追加しない）。research.md Decision 5

**Checkpoint**: 将来の非必須 Cookie を同意状態で制御できる枠組みが揃う

---

## Phase 6: User Story 4 - 後から選択を変更 (Priority: P3)

**Goal**: フッターの「Cookie 設定」からいつでもバナーを再表示し選択を変更できる

**Independent Test**: 選択済み状態でフッター「Cookie 設定」を押すとバナーが再表示され、変更を保存できる（quickstart シナリオ D）

### Tests for User Story 4 ⚠️

- [X] T017 [P] [US4] `CookieSettingsButton` の Vitest（押下で `openSettings` 呼び出し）in `service-front/src/features/consent/components/client/CookieSettingsButton/CookieSettingsButton.test.tsx`
- [X] T018 [P] [US4] `CookieSettingsButton` の Storybook story
- [ ] T019 [P] [US4] Playwright E2E: 選択済み → フッター「Cookie 設定」→ バナー再表示 → 変更保存（quickstart シナリオ D）

### Implementation for User Story 4

- [X] T020 [US4] `CookieSettingsButton` 実装 in `service-front/src/features/consent/components/client/CookieSettingsButton/CookieSettingsButton.tsx` + `index.ts`（実 `<button>`「Cookie 設定」、`store.openSettings()` を呼ぶ）
- [X] T021 [US4] `service-front/src/shared/components/layout/Footer/Footer.tsx` に `CookieSettingsButton` を追加（フッターは Server のためボタンは Client 子コンポーネントとして配置）

**Checkpoint**: 同意済みユーザーも後から選択を変更できる

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 仕上げと回帰確認

- [X] T022 [P] `service-front/src/features/consent/index.ts` に公開エクスポート（`CookieConsentBanner` / `CookieSettingsButton` / `getCookieConsentClient` / `getCookieConsentServer` / store）を追加
- [ ] T023 [P] 既存 a11y テスト（`tests/a11y/public-pages.spec.ts` 等）がバナー追加後も WCAG 2.1 AA 違反ゼロのまま回帰しないことを確認
- [ ] T024 既存ページ（公開・認証）の表示回帰と、ブラウザの Cookie 無効時に毎回バナー表示となる挙動（Edge Case）を確認
- [X] T025 `/review` と仕様同期（`sync-spec`）を実行し、実装と spec / plan / data-model のずれを解消（sync-spec で contracts/plan を実装に追従、review 指摘の是正を適用）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 後。全ユーザーストーリーをブロック（util + store）
- **User Stories (Phase 3〜6)**: Foundational 後に開始
- **Polish (Phase 7)**: 対象ストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Foundational 後に開始可。バナー表示・選択の主動線（MVP の中核）
- **US2 (P1)**: US1 の banner + layout に依存（永続化・再表示判定はそこで成立）。検証中心
- **US3 (P1)**: Foundational の `getCookieConsentClient` に依存。banner とは独立に検証可
- **US4 (P3)**: Foundational（store）+ US1（banner の `forcedOpen` 購読は T010 で実装済み）に依存。ボタン + フッターのみ

### Within Each User Story

- テストを先に書き FAIL を確認 → 実装 → 統合（layout / footer）

### Parallel Opportunities

- Foundational の T002/T003（util）と T004/T005（store）は別ファイルで並列可
- 各ストーリーのテストタスク（[P]）はまとめて並列実行可
- US3 は Foundational 後、US1 と並列着手可（依存が `getCookieConsentClient` のみ）

---

## Parallel Example: User Story 1

```bash
# US1 のテストを一括起動（実装前・FAIL 確認）:
Task: "CookieConsentBanner の Vitest (T006)"
Task: "CookieConsentBanner の Storybook (T007)"
Task: "バナー表示状態の Playwright a11y (T008)"
Task: "初回表示→同意 の E2E (T009)"
```

---

## Implementation Strategy

### MVP First（US1 + US2 + US3）

1. Phase 1: Setup
2. Phase 2: Foundational（util + store）
3. Phase 3: US1（表示・選択）→ Phase 4: US2（永続化検証）→ Phase 5: US3（gating 枠組み）
4. **STOP and VALIDATE**: quickstart シナリオ A/B/C/E を検証 → 同意取得の主動線と gating 枠組みが完成（MVP）

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 → US2 → US3 → MVP 検証
3. US4（後から変更）を追加
4. Polish（エクスポート・回帰・仕様同期）

---

## Notes

- [P] = 別ファイル・依存なし
- Constitution III に従い、コンポーネントは Vitest + Storybook + Playwright a11y を同梱（`/generate-with-tests` を活用可）
- DB / Supabase / マイグレーションは不要（純フロント）
- バナーは非モーダル（フォーカストラップなし）・閉じる✕なし（FR-014 / FR-015）
- 同意状態の参照は必ず `getCookieConsent*` を経由（gating の単一参照点）
- 認証セッション等の必須 Cookie は同意状態に関わらず維持（FR-008）
