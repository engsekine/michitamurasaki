# Tasks: SNS 共有ボタン

**Input**: Design documents from `/specs/035-sns-share-buttons/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sns-share-buttons.md

**Tests**: Constitution III（Test-First）によりテストタスクを含む。各コンポーネントのテストは実装より先に書き、失敗を確認してから実装する。

**Organization**: ユーザーストーリー単位でフェーズを分け、各ストーリーを独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2）
- パスはすべてリポジトリルートからの相対パス

## Phase 1: Setup

**Purpose**: コンポーネントフォルダの用意。新規依存パッケージ・DB 変更は無いため最小限

- [X] T001 コンポーネントフォルダ `service-front/src/shared/components/social/SnsShareButtons/` を作成する（folder-structure.md の「本体 + テスト + stories + index.ts」構成の置き場。`social/` グループも新規）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US1 / US2 の両方が依存する共通コンポーネント `SnsShareButtons` 一式。contracts/sns-share-buttons.md が正

**⚠️ CRITICAL**: このフェーズ完了までユーザーストーリーの実装に着手しない

- [X] T002 [P] `SnsShareButtons` の Vitest 単体テストを `service-front/src/shared/components/social/SnsShareButtons/SnsShareButtons.test.tsx` に**先に**書く（実装前に失敗することを確認）。検証項目: ①「X で共有」「Facebook で共有」「Instagram で共有（リンクをコピー）」のアクセシブルな名前 ② X の href が `https://x.com/intent/post?text=<text>&url=<url>`（`URLSearchParams` エンコード、`#`・絵文字入りテキストで欠落なし） ③ Facebook の href が `https://www.facebook.com/sharer/sharer.php?u=<url>` ④ 両アンカーに `target="_blank" rel="noopener noreferrer"` ⑤ Instagram クリックで `navigator.clipboard.writeText` が `"<text> <url>"` で呼ばれ、`role="status"` の案内表示後に `window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')` ⑥ コピー失敗時は `role="alert"` + readonly `<input>`（フォーカスで全選択）が表示され `window.open` は呼ばれない
- [X] T003 [P] ブランド SVG アイコン内部コンポーネント（`XIcon` / `FacebookIcon` / `InstagramIcon`、いずれも `aria-hidden="true"`・named export）を `service-front/src/shared/components/social/SnsShareButtons/SnsBrandIcons.tsx` に作成する（research.md R4。外部依存なし・各社ガイドライン準拠の形状・単色）
- [X] T004 `SnsShareButtons` 本体（`'use client'`、Props `{ url: string; text: string }`、`copyStatus: 'idle' | 'copied' | 'failed'` のローカル state、タッチターゲット 44px 以上の Tailwind スタイル）を `service-front/src/shared/components/social/SnsShareButtons/SnsShareButtons.tsx` に実装し、T002 のテストを green にする（T002・T003 完了後）
- [X] T005 [P] Storybook story（通常表示・コピー成功・コピー失敗の 3 状態）を `service-front/src/shared/components/social/SnsShareButtons/SnsShareButtons.stories.tsx` に作成する（T004 完了後）
- [X] T006 [P] 再 export 専用の `service-front/src/shared/components/social/SnsShareButtons/index.ts` を作成する（`export { SnsShareButtons } from './SnsShareButtons';`、T004 完了後）

**Checkpoint**: `npm run test --workspace=service-front -- SnsShareButtons` が green。以降 US1 / US2 に着手可能

---

## Phase 3: User Story 1 - 公開ダイビングログを SNS で共有する (Priority: P1) 🎯 MVP

**Goal**: 公開ログ詳細（`/dives/[id]`）に共有ボタンを表示し、所有者・閲覧者とも X / Facebook / Instagram へ共有できる（FR-001 / FR-003〜FR-010）

**Independent Test**: 公開ログ詳細で 3 ボタンが表示され各 SNS 共有が動作、非公開ログでは非表示（quickstart.md「1. 公開ログの共有」）

- [X] T007 [US1] `service-front/src/features/dives/components/server/DiveDetail/DiveDetail.test.tsx` に**先に**回帰テストを追加する（`isPublic: true` で共有ボタン（「X で共有」等）が表示され、`false` では表示されないこと。実装前に失敗を確認）
- [X] T008 [US1] `service-front/src/features/dives/components/server/DiveDetail/DiveDetail.tsx` に `SnsShareButtons` を埋め込む（`dive.isPublic === true` のときのみ・`canManage` に依存させない独立セクション。`url` = `` `${SITE_URL}/dives/${dive.id}` ``、`text` = 「{dive.location}のダイビングログ（{日付}）| {SITE_NAME}」。`SITE_URL` / `SITE_NAME` は `@/shared/constants/site`、日付整形は `@/shared/lib/date` の既存ユーティリティを使用。contracts/sns-share-buttons.md「埋め込み契約」参照）
- [X] T009 [P] [US1] `service-front/src/features/dives/components/server/DiveDetail/DiveDetail.stories.tsx` を同期更新する（公開ログ story で共有ボタンが写るようにする。T008 完了後）
- [X] T010 [P] [US1] `service-front/tests/a11y/dives-pages.spec.ts` に公開ログ詳細の共有ボタン表示状態での axe 検証（WCAG 2.1 AA 違反 0 件）を追加する（T008 完了後）
- [X] T011 [US1] `service-front/tests/sns-share.spec.ts` を新規作成し e2e シナリオを追加する（公開ログ詳細で ① 3 ボタン表示 ② X アンカーの href に共有 URL・テキストが入っている ③ Instagram クリックで「リンクをコピーしました」案内表示 ④ 非公開に戻すとボタン非表示。※ social-flows.spec.ts は別作業の未コミット変更があるため新規ファイルに分離。T008 完了後）

**Checkpoint**: US1 単独で quickstart.md「1. 公開ログの共有」が全項目成功 = MVP 完成

---

## Phase 4: User Story 2 - ユーザープロフィールを SNS で共有する (Priority: P2)

**Goal**: プロフィール（`/users/[slug]`）に共有ボタンを表示し、自分・他人のプロフィール URL を共有できる（FR-002 / FR-003〜FR-010）

**Independent Test**: 自分・他人のプロフィールで 3 ボタンが表示され、プロフィール URL が共有対象になる（quickstart.md「2. プロフィールの共有」）

- [X] T012 [US2] `service-front/src/features/social/components/server/PublicProfile/PublicProfile.test.tsx` を**先に**新規作成する（既存テストなし。共有ボタン表示と、`url` が handle ベースのプロフィール URL になることを検証。実装前に失敗を確認）
- [X] T013 [US2] `service-front/src/features/social/components/server/PublicProfile/PublicProfile.tsx` に `SnsShareButtons` を埋め込む（自分・他人とも常時表示。`url` = `` `${SITE_URL}${profilePath({ userId: profile.userId, handle: profile.handle })}` ``（`@/shared/lib/profile-path`）、`text` = 「{profile.nickname}のダイビングプロフィール | {SITE_NAME}」。contracts/sns-share-buttons.md「埋め込み契約」参照）
- [X] T014 [P] [US2] `service-front/src/features/social/components/server/PublicProfile/PublicProfile.stories.tsx` を新規作成する（Constitution III の同梱物。isSelf / 他人閲覧の 2 story。T013 完了後）
- [X] T015 [P] [US2] プロフィールページの共有ボタン表示状態での axe 検証（既存の `service-front/tests/a11y/social-pages.spec.ts` スイープが `/users/<id>` を検査しており、共有ボタンは常時表示のため追記なしでカバー。実行して違反 0 件を確認済み）
- [X] T016 [US2] `service-front/tests/sns-share.spec.ts` にプロフィール共有の e2e シナリオを追加する（自分・他人のプロフィールでボタン表示、X の href にプロフィール URL。T011 と同一ファイルのため T011 完了後に着手）

**Checkpoint**: US1・US2 とも独立して動作し、quickstart.md「2. プロフィールの共有」が成功

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 横断的な仕上げ・検証

- [X] T017 quickstart.md の検証を実施する（e2e `tests/sns-share.spec.ts` + a11y 2 スペックで自動検証済み。記号・絵文字の X 共有とコピー失敗フォールバックは Vitest 単体テストで担保。ブラウザでの見た目確認は任意で残る）
- [X] T018 `npx biome check .` を実行し、指摘があれば `npx biome check --write .` + 手動修正で解消する
- [X] T019 `/sync-spec` で spec.md / plan.md と実装のずれを確認し、ズレがあれば仕様書側を実装に合わせて更新する

---

## Phase 6: 改定（2026-07-16）: Instagram 共有の削除

**Purpose**: spec Clarifications（Session 2026-07-16）に基づき Instagram 共有を削除し、対象を X / Facebook の 2 つにする。クリップボード機構が不要になり `SnsShareButtons` は状態なしの Server Component へ簡素化

- [X] T020 `SnsShareButtons.tsx` から Instagram ボタン・`copyStatus` state・クリップボード処理・フォールバック UI を削除し `'use client'` を外す。`SnsBrandIcons.tsx` から `InstagramIcon` を削除。テスト・story を同期（Instagram 非表示の回帰テストを追加）
- [X] T021 `DiveDetail.test.tsx` / `PublicProfile.test.tsx` / `tests/sns-share.spec.ts` から Instagram 関連の検証を削除し、2 ボタン前提に更新（unit 35 件・e2e 2 件 green を確認）
- [X] T022 仕様書一式（spec.md / plan.md / research.md R3〜R5 / data-model.md / contracts / quickstart.md）を改定内容に同期

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（Setup）**: 依存なし
- **Phase 2（Foundational）**: Phase 1 完了後。**US1 / US2 の両方をブロックする**
- **Phase 3（US1）/ Phase 4（US2）**: Phase 2 完了後。US1 と US2 は互いに独立（別ファイル）だが、T011 / T016 が同一ファイル（`tests/sns-share.spec.ts`）を編集するため、この 2 タスクのみ直列（T011 → T016）
- **Phase 5（Polish）**: 実装対象の全ストーリー完了後

### Within Each Story

- テストを先に書き、失敗を確認してから実装（T002→T004、T007→T008、T012→T013）
- 本体実装 → story / a11y / e2e の順（story・a11y は [P] で並列可）

### Parallel Opportunities

- Phase 2: T002 と T003 が並列可。T004 完了後、T005 / T006 が並列可
- Phase 2 完了後、US1（T007〜）と US2（T012〜）は並列着手可（T011 / T016 の直列制約のみ注意）
- 各ストーリー内: T009 / T010（US1）、T014 / T015（US2）が並列可

## Parallel Example: Phase 2 → US1 / US2 同時進行

```bash
# Phase 2 立ち上げ（並列）:
Task: "SnsShareButtons.test.tsx を書く（T002）"
Task: "SnsBrandIcons.tsx を作る（T003）"

# Phase 2 完了後（並列）:
Task: "US1: DiveDetail.test.tsx に回帰テスト追加（T007）"
Task: "US2: PublicProfile.test.tsx を新規作成（T012）"
```

## Implementation Strategy

### MVP First（US1 のみ）

1. Phase 1 → Phase 2（共通コンポーネント完成）
2. Phase 3（US1: 公開ログ共有）
3. **STOP & VALIDATE**: quickstart.md「1. 公開ログの共有」で単独検証 → MVP としてデモ可能
4. Phase 4（US2）→ Phase 5（Polish）

### Notes

- 各タスク（または論理的なまとまり）ごとにコミットする（`feat(035):` / `test(035):` プレフィックス）
- DB・シード・マイグレーション作業は本機能には存在しない（data-model.md）
- 既存の `DiveVisibilityToggle`（所有者用共有リンクコピー）には手を入れない
