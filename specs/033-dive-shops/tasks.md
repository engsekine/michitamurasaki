# Tasks: ダイビングショップ登録

**Input**: Design documents from `/specs/033-dive-shops/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md, contracts/server-actions.md, quickstart.md

**Tests**: Constitution III（Test-First）に従い、schema・lib・Server Actions は Vitest を先に書き、コンポーネントは本体 + `.test.tsx` + `.stories.tsx` + `index.ts` を同梱する（`rules/folder-structure.md`）。E2E / a11y は Playwright。

**Organization**: ユーザーストーリー単位（US1: CRUD = MVP、US2: 紐付け、US3: 地図）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（別ファイル・未完了タスクへの依存なし）
- **[Story]**: US1 / US2 / US3（ユーザーストーリーフェーズのみ）

---

## Phase 1: Setup

**Purpose**: DB スキーマと環境変数の下準備

- [X] T001 [P] マイグレーション作成: `supabase/migrations/<ts>_create_dive_shops.sql` に `dive_shops` テーブル（name 必須 120・address 255・phone 20・website_url 2048・memo 1000・latitude/longitude nullable・created_at/updated_at）+ `idx_dive_shops_user_id` + RLS 有効化と本人限定 4 ポリシー + `handle_updated_at` トリガー + comment を定義する（data-model.md 参照）。`npx supabase db reset` で適用確認
- [X] T002 [P] マイグレーション作成: `supabase/migrations/<ts>_add_dive_shop_links.sql` に `dives` / `dive_plans` / `application_sheets` への `dive_shop_id uuid references public.dive_shops(id) on delete set null` 追加 + FK インデックス 3 本 + 所有者ガード関数 `public.ensure_dive_shop_owned()`（`set search_path = ''`）と 3 テーブルへのトリガーを定義する（data-model.md 参照）
- [X] T003 [P] `service-front/.env.example` に `GOOGLE_MAPS_API_KEY`（サーバー専用・ジオコーディング用）を追記し、用途コメントを添える

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shops feature の土台（型・スキーマ・ジオコーディング・server 層・認証ガード）。全ストーリーがここに依存する

**⚠️ CRITICAL**: このフェーズ完了までユーザーストーリーの実装に着手しない

- [X] T004 `service-front/src/features/shops/types.ts`（`Shop` / `ShopOption` / `ShopInput` / `GeocodeResult` / `LinkedPlan` / `LinkedDive`）と `constants.ts`（PAGE_DATA 相当のページ情報・入力上限値・地図非表示時メッセージ等の文言）を作成する
- [X] T005 [P] `service-front/src/features/shops/schemas/shop.schema.ts` を **テスト先行**で作成: `shop.schema.test.ts` に name 必須/120 超・空白のみ拒否、address 255、phone 形式（数字・ハイフン・`+`・20 文字）、website_url URL 形式/2048、memo 1000 のケースを書いてから yup スキーマを実装する
- [X] T006 [P] `service-front/src/features/shops/lib/geocode/` を **テスト先行**で作成（`geocode.ts` + `geocode.test.ts` + `index.ts`）: Google Geocoding API を `fetch` で呼び `{ lat, lng } | null` を返す。テストは fetch モックで OK / ZERO_RESULTS / HTTP エラー / `GOOGLE_MAPS_API_KEY` 未設定の 4 系統（contracts/server-actions.md 参照）。server-only ガードを付ける
- [X] T007 `service-front/src/features/shops/server/queries.ts` に `getShops` / `getShop` / `getShopOptions` / `getLinkedRecords` を実装する（contracts/server-actions.md のシグネチャ・並び順に従う。T004 に依存）
- [X] T008 `service-front/src/features/shops/server/actions.ts` を **テスト先行**で作成（`actions.test.ts` → 実装）: `createShop`（検証 → 住所非空ならジオコーディング → INSERT → `{ id }`）/ `updateShop`（住所変更時のみ再ジオコーディング・空なら座標 null）/ `deleteShop`（DELETE のみ・紐付け解除は DB に委ねる）/ `geocodeAddress`（失敗系はすべて null 座標の成功応答）。T005・T006 に依存
- [X] T009 `service-front/src/proxy.ts` の `APP_ROUTE_PREFIXES` に `'/shops'` を追加する（それ以外は変更しない。契約: contracts/routes.md）

**Checkpoint**: DB・server 層・認証ガードが揃い、画面実装を開始できる

---

## Phase 3: User Story 1 - ショップを登録・管理する (Priority: P1) 🎯 MVP

**Goal**: `/shops` 配下でショップの登録・一覧・詳細・編集・削除が本人限定で完結する

**Independent Test**: quickstart.md シナリオ 1（登録 → 一覧 → 詳細 → 編集 → 削除、名前空はエラー、URL 別タブ）+ シナリオ 6 の認証ガード

- [X] T010 [P] [US1] `service-front/src/features/shops/components/client/ShopForm/`（ShopForm.tsx + test + stories + index.ts）: RHF + yup（T005）で 5 項目を編集。エラーは `role="alert"` + `aria-invalid`、label 関連付け。登録/編集を initialValues の有無で兼用（この時点では地図プレビューなし。US3 で拡張）
- [X] T011 [P] [US1] `service-front/src/features/shops/components/client/DeleteShopButton/`（本体 + test + stories + index.ts）: 確認ダイアログ → `deleteShop` 呼び出し → `/shops` へ
- [X] T012 [P] [US1] `service-front/src/features/shops/components/server/ShopList/`（本体 + test + stories + index.ts）: 名前・住所要約のカード一覧。0 件時は空状態メッセージ + 登録導線（FR-003・エッジケース）
- [X] T013 [US1] `service-front/src/app/(authenticated)/shops/page.tsx`（一覧。`generatePageMetadata` + Header/Footer + Heading + 「ショップを登録」ボタン）と `new/page.tsx`（ShopForm）を作成する。T010・T012 に依存
- [X] T014 [US1] `service-front/src/app/(authenticated)/shops/[id]/page.tsx`（詳細: 全項目表示・URL は `target="_blank"` + `rel="noreferrer"`・電話は `tel:` リンク・編集/削除導線。取得 0 件は `notFound()`）と `[id]/edit/page.tsx`（初期値入り ShopForm）を作成する。T010・T011 に依存
- [X] T015 [US1] `service-front/src/shared/components/layout/Header/Header.tsx` の `NAV_ITEMS` と `HeaderMobileNav.tsx` に `{ href: '/shops', label: 'ショップ' }` を追加し、`Header.test.tsx` / `HeaderMobileNav.test.tsx` / stories を同期更新する
- [X] T016 [US1] Playwright E2E + a11y: `service-front/tests/shops.spec.ts`（登録 → 一覧 → 詳細 → 編集 → 削除、名前空エラー、未認証 `/shops` → `/login`）と `service-front/tests/a11y/shops-pages.spec.ts`（`/shops` `/shops/new` `/shops/[id]` `/shops/[id]/edit` の axe スキャン + モバイル 375px 横スクロールなし）を作成する

**Checkpoint**: US1 単体で「ショップの連絡先・メモ帳」として出荷可能（MVP）

---

## Phase 4: User Story 2 - 予定・ログ・申し込みシートにショップを紐付ける (Priority: P2)

**Goal**: 予定・ログ・シートにショップを任意選択で紐付け、詳細に表示。ショップ詳細から逆引きできる

**Independent Test**: quickstart.md シナリオ 3（紐付け → 詳細表示 → 逆引き）・シナリオ 4（削除で解除）・シナリオ 5（公開ビュー非表示）

- [X] T017 [P] [US2] plans 側の紐付け: `service-front/src/features/plans/schemas/plan.schema.ts` に `diveShopId: string | null` を追加し、`server/actions.ts`（作成・更新で本人所有チェック。不正 id は actionFailure）・`server/queries.ts`（詳細でショップ `{ id, name }` を join 取得）を更新する。`plan.schema.test.ts` / actions のテストを同期更新する
- [X] T018 [US2] plans 側の UI: `PlanForm` にショップ選択 `<select>`（`shopOptions` props・「選択しない」既定・0 件時は登録導線メッセージ）を追加し、`/plans/new`・編集 page で `getShopOptions()` を注入する。予定詳細にショップ名 + `/shops/[id]` リンクを表示する。PlanForm の test / stories を同期更新する。T017 に依存
- [X] T019 [P] [US2] dives 側の紐付け: `service-front/src/features/dives/schemas/dive.schema.ts` + `server/actions.ts` + `server/queries.ts` を T017 と同じ方針で更新する（公開系 query には一切追加しない: FR-015 / research.md Decision 6）。テストを同期更新する
- [X] T020 [US2] dives 側の UI: `DiveForm` にショップ選択（`shopOptions` props）を追加し、`/dives/new`・編集 page で注入する。ログ詳細（本人向け）にショップ名 + リンクを表示する。DiveForm の test / stories を同期更新する。T019 に依存
- [X] T021 [P] [US2] application-sheet 側: schema・保存 action（`application_sheets.dive_shop_id` の upsert）・初期表示 query（保存済み宛先の復元）に宛先ショップを追加し、`ApplicationSheetForm` に選択欄（`shopOptions` props）を追加する。page で注入。関連テスト・stories を同期更新する（research.md Decision 4）
- [X] T022 [US2] `service-front/src/features/shops/components/server/ShopLinkedRecords/`（本体 + test + stories + index.ts）: 紐付いた予定（`planned_on` 降順）・ログ（`dive_date` 降順）の一覧を表示し各詳細へリンク。0 件時はその旨表示（FR-016）。`/shops/[id]/page.tsx` に `getLinkedRecords` の結果を組み込む
- [X] T023 [US2] E2E 追記: `service-front/tests/shops.spec.ts` に「予定・ログ・シートへ紐付け → 各詳細に表示 → ショップ詳細で逆引き → ショップ削除で紐付けのみ解除（予定・ログは残る）」と「ショップ紐付きログを公開 → 別セッションの公開ビューにショップ情報が出ない（FR-015）」を追加する

**Checkpoint**: US1 + US2 が独立して動作。ショップが記録と結びつく

---

## Phase 5: User Story 3 - 住所から地図で場所を確認する (Priority: P3)

**Goal**: 登録・編集画面で住所確定時に地図が自動表示され、詳細画面でも保存済み座標で地図が出る

**Independent Test**: quickstart.md シナリオ 2（実在住所 → 地図、架空住所 → メッセージ + 保存可、詳細は保存済み座標で表示）

- [X] T024 [P] [US3] `service-front/src/features/shops/components/server/ShopMap/`（本体 + test + stories + index.ts）: props `latitude` / `longitude` / `shopName`。座標あり → `title` 付き Google マップ iframe（`loading="lazy"`）、座標 null → iframe を出さず `role="status"` メッセージ（contracts/routes.md の地図表示契約）
- [X] T025 [US3] `ShopForm` に住所プレビューを追加: 住所欄の入力確定（blur・値変更）で `geocodeAddress` を呼び、ShopMap と同じ表示規則でプレビューを更新する（FR-011 / FR-013。連打対策に確定時のみ呼ぶ）。ShopForm の test / stories を同期更新する。T024 に依存
- [X] T026 [US3] `/shops/[id]/page.tsx` の詳細に `ShopMap` を組み込む（保存済み座標を渡す。座標 null なら地図領域ごと非表示 or メッセージ — 住所未入力時は領域非表示、住所ありで座標 null はメッセージ表示: spec US3-3・US3-4）。T024 に依存
- [X] T027 [US3] E2E 追記: `service-front/tests/shops.spec.ts` に地図表示の検証を追加する（`GOOGLE_MAPS_API_KEY` 未設定環境では「地図を表示できない」メッセージ側の分岐を検証し、iframe 検証はキー設定時のみ実行するよう `test.skip` 条件を付ける）

**Checkpoint**: 全ストーリーが独立して機能する

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T028 [P] 全体検証: `npx tsc --noEmit`・`npx biome check`（変更ファイル）・`npx vitest run --project unit`（cwd は `service-front`）・`npx playwright test tests/shops.spec.ts tests/a11y/shops-pages.spec.ts` をすべて green にする
- [X] T029 [P] quickstart.md のシナリオ 1〜6 を手動検証する（要 `GOOGLE_MAPS_API_KEY`: シナリオ 2）
- [X] T030 `/sync-spec` で spec.md / data-model.md / contracts と実装のずれを最終確認し、ずれがあれば仕様書側を更新する

---

## 実装メモ（033 再実装セッション / 2026-07-12）

初回実装は PR #41 に specs のみが含まれ、コード本体は未コミットのままワークツリーごと消失した。
本セッションでセッショントランスクリプトから全ファイルを復元し、develop の変更（032 の
application_profiles → application_sheets 置換）へ適応して再実装した。

**設計変更（初回実装からの差分）**
- 申し込みシートの宛先ショップ: application_profiles（ユーザー単位 1 件の復元）→ `application_sheets.dive_shop_id`（保存シートごとのスナップショット）
- マイグレーションは `20260712170000_create_dive_shops.sql` / `20260712170100_add_dive_shop_links.sql`
- `packages/supabase/src/types.ts` は手動追記（supabase CLI が LegacyDbConfigLoadError で gen types 不可のため）

**検証（すべて green）**
- `npx tsc --noEmit` / `npx biome check .`: エラー 0
- `npx vitest run --project unit`: 1493 passed
- `npx playwright test tests/shops.spec.ts tests/a11y/shops-pages.spec.ts --workers=2`: **10 passed × 2 回連続**
- 回帰: `tests/application-sheet-flows.spec.ts` 4 passed / `tests/plan-to-log-flows.spec.ts` 3 passed

**E2E 安定化・既存負債の修正（同梱）**
- ShopList / ShopLinkedRecords の `hover:bg-accent` を `hover:bg-muted/50` に変更（ホバー時に muted 文字が 4.34:1 と AA 未達になる実バグ。PlanList の前例に準拠）
- shops / plan-to-log の E2E: 固定名・固定ダイブ番号を実行ごとに一意化し後始末を追加（失敗残骸との衝突防止）
- plan-to-log の既存アサーション 2 件を 7/9 のパンくず・予定カード変更に追従（heading 絞り込み・「予定の詳細」リンク経由）

**運用ノート**
- ローカル並列 5 ワーカーでは dev サーバーのコンパイル待ちで 30 秒タイムアウトが出ることがある（CI は workers=1 / timeout=120s のため影響なし）。ローカルは `--workers=2` 推奨
- GOOGLE_MAPS_API_KEY 未設定時は geocode が null を返し、地図は「表示できない」文言になる（機能は成立）。`.env.example` への追記は手動対応のまま

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 依存なし。T001 / T002 / T003 は並列可
- **Phase 2 (Foundational)**: T001 完了後（T002 は T007 のクエリ検証までに適用されていればよい）。**T004〜T009 が全ストーリーをブロック**。T005 / T006 は並列可、T007・T008 は T004 以降
- **Phase 3 (US1)**: Phase 2 完了後。T010 / T011 / T012 は並列可 → T013 / T014 → T015 → T016
- **Phase 4 (US2)**: Phase 2 + T014（ショップ詳細ページ）完了後。T017 / T019 / T021 は並列可（別 feature・別ファイル）
- **Phase 5 (US3)**: Phase 2 + T010（ShopForm）・T014（詳細ページ）完了後。US2 とは独立に進められる
- **Phase 6 (Polish)**: 全ストーリー完了後

### Parallel Opportunities

- T001 / T002 / T003（Setup）
- T005 / T006（schema と geocode lib — 別フォルダ）
- T010 / T011 / T012（コンポーネント 3 つ — 別フォルダ）
- T017 / T019 / T021（plans / dives / application-sheet — 別 feature）
- T024（ShopMap）は Phase 4 と並行可
- T028 / T029（検証系）

### Parallel Example: User Story 1

```bash
# コンポーネント 3 フォルダを同時に着手（それぞれ本体 + test + stories + index.ts）:
Task: "ShopForm を service-front/src/features/shops/components/client/ShopForm/ に作成"
Task: "DeleteShopButton を service-front/src/features/shops/components/client/DeleteShopButton/ に作成"
Task: "ShopList を service-front/src/features/shops/components/server/ShopList/ に作成"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 → Phase 2（DB + server 層 + 認証ガード）
2. Phase 3（US1: CRUD 画面一式 + ナビ + E2E/a11y）
3. **STOP and VALIDATE**: quickstart シナリオ 1・6 で単独検証 → この時点で出荷可能

### Incremental Delivery

1. + Phase 4（US2: 紐付け + 逆引き）→ シナリオ 3〜5 検証 → デリバリー
2. + Phase 5（US3: 地図）→ シナリオ 2 検証 → デリバリー
3. Phase 6 で全体検証と仕様書同期

---

## Notes

- コンポーネントは必ず専用フォルダ（本体 + `.test.tsx` + `.stories.tsx` + `index.ts`）で作成し、外部からは `index.ts` 経由で import する（`rules/folder-structure.md`）
- feature 間 import は禁止。ショップ選択肢（`ShopOption[]`）・逆引きデータは **page 側で取得して props 注入**する（research.md Decision 5）
- 公開系（social / likes / 公開ログ詳細）の query・コンポーネントには `dive_shop_id` を一切追加しない（FR-015）
- 見出しは `Heading`（`@/shared/components/typography/Heading`）、metadata は `generatePageMetadata` を使用する
- worktree 環境では `node_modules` がメインリポジトリ解決になる点に注意（vitest は cwd=`service-front` で実行）
