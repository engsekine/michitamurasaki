# Tasks: モバイルアプリ（第 1 段階: オフラインログ作成・転送・閲覧・エクスポート）

**Input**: Design documents from `specs/029-mobile-offline-logs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: constitution 原則 III（Test-First）に従い、純粋ロジック（スキーマ変換・同期状態機械・キュー判断・DAL 変換）は **Vitest 先行**。RN コンポーネントは jest-expo + RNTL（plan.md Complexity Tracking）。実機挙動は quickstart.md で担保。

**Organization**: ユーザーストーリー単位。US1（オフライン作成→転送）が MVP。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2 / US3）

## Path Conventions

- モバイル: `mobile/`（新規 Expo ワークスペース）/ 共有: `packages/core/`（新規）
- Web 変更は 2 点のみ: スキーマ re-export・エクスポートルート Bearer 対応（contracts/app-screens.md）

---

## Phase 1: Setup（ワークスペースと共有パッケージ）

**Purpose**: monorepo に mobile / packages-core を用意し、全ストーリーの土台を作る

- [X] T001 `packages/core` を新設する: `packages/core/package.json`（name: `@repo/core`・React 非依存の純 TS）+ `tsconfig.json` + Vitest 設定。root `package.json` の workspaces は `packages/*` で自動包含されることを確認
- [X] T002 dive スキーマを共有化する: `service-front/src/features/dives/schemas/dive.schema.ts` と依存定数（ダイブタイプ等の選択肢）・入力型を `packages/core/src/schemas/dive.schema.ts` / `packages/core/src/constants/` へ移動し、service-front 側は同パスからの re-export に置換。`npm run test --workspace service-front` で既存テスト（dive.schema.test.ts 含む）が無変更で通ることを確認
- [X] T003 Expo アプリを scaffold する: `npx create-expo-app mobile`（expo-router テンプレート・TypeScript strict）。root `package.json` の workspaces へ `"mobile"` を追加し、`mobile/metro.config.js` に monorepo 設定（watchFolders / nodeModulesPaths）を入れて起動確認（`npm run start --workspace mobile`）
- [X] T004 [P] トークン共有を実装する（実装時判断: NativeWind は RN 0.86/SDK 57 互換が未検証のため、packages/ui のトークン値を mobile/src/theme/tokens.ts へ移植する方式に変更。/sync-spec で plan に反映済み）: `mobile/tailwind.config.js` が `packages/ui` のテーマ（色・radius）を参照する構成 + `mobile/src/theme/`（contracts/app-screens.md「パッケージ境界」）
- [X] T005 [P] Supabase クライアントを作成する: `mobile/src/lib/supabase/client.ts`（`@supabase/supabase-js` + expo-secure-store セッションアダプタ + `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`）。`@repo/supabase` の Database 型を参照
- [X] T006 [P] mobile のテスト基盤を設定する: 純粋ロジック用 Vitest（`mobile/vitest.config.ts`・`src/**/*.test.ts` 対象）と RN コンポーネント用 jest-expo + React Native Testing Library（`mobile/jest.config.js`・`*.test.tsx` 対象）を分離して両方の実行を確認

**Checkpoint**: `mobile` がシミュレータで起動し、`@repo/core` のスキーマを import できる

---

## Phase 2: Foundational (ローカル DB と認証 — 全ストーリーをブロック)

**Purpose**: SQLite 永続化と認証ゲート。US1〜US3 すべての前提

- [X] T007 [P] DAL の Vitest を先行作成する: `mobile/src/lib/db/dal.test.ts`（pending の CRUD と状態更新 / cached の upsert・全件置換 / user_id 分離 / 一覧統合クエリ（cached ∪ pending の dive_date 降順）。SQLite ドライバはインターフェース越しにフェイク実装を注入）
- [X] T008 SQLite DAL を実装する: `mobile/src/lib/db/`（schema.ts = data-model.md §1 の 3 テーブル DDL + 起動時マイグレーション、dal.ts = pending/cached/meta の操作関数。T007 を green にする）
- [X] T009 認証を実装する: `mobile/app/(auth)/login.tsx`（メール + パスワード）と `mobile/app/_layout.tsx` の認証ゲート（セッションなし → login へ）。セッションは SecureStore に永続化（research R6）。ログインフォームの jest-expo テストを同梱
- [X] T010 ローカルデータの所有者分離を実装する: ログアウト時の未転送警告 + 確認後の該当 user_id データ削除、別ユーザーログイン時に他ユーザーの pending/cached を表示・転送しないガード（FR-019。data-model.md §3。判定ロジックは Vitest 先行）

**Checkpoint**: ログイン → 空の一覧が表示でき、SQLite が永続化されている

---

## Phase 3: User Story 1 - オフラインでのログ作成とオンライン転送 (Priority: P1) 🎯 MVP

**Goal**: 圏外でログを作成 → 端末保存 → 通信回復でフォアグラウンド自動転送（冪等）→ Web に反映

**Independent Test**: quickstart.md シナリオ 1（機内モード作成 → 解除で自動転送 → Web 反映・二重登録ゼロ）

### Tests for User Story 1（実装より先に書き、失敗を確認する）

- [X] T011 [P] [US1] 変換関数の Vitest を先行作成する: `packages/core/src/lib/diveTransfer.test.ts`（DiveFormValues → `dives` INSERT 行の変換。id / user_id の固定・null 項目・数値変換のラウンドトリップ）
- [X] T012 [P] [US1] 同期状態機械の Vitest を先行作成する: `mobile/src/features/sync/lib/syncMachine.test.ts`（pending→syncing→成功 / 23505 = 冪等成功 / ネットワーク例外 = pending 復帰 / その他 = failed + 理由 / syncing 残留の起動時復旧 / 直列順序と再入抑止。contracts/sync-protocol.md のテスト契約どおり）

### Implementation for User Story 1

- [X] T013 [P] [US1] 変換関数を実装する: `packages/core/src/lib/diveTransfer.ts`（T011 を green にする）
- [X] T014 [US1] 同期エンジンのコアを実装する: `mobile/src/features/sync/lib/syncMachine.ts`（RN 非依存の純粋関数: 次アクション決定・結果分類・状態遷移。T012 を green にする）
- [X] T015 [US1] 同期エンジンのランナーを実装する: `mobile/src/features/sync/engine.ts`（DAL + supabase + syncMachine を接続。1 件ずつ直列・進捗通知・シングルトン再入抑止。セッション失効時はキューに触れず再ログイン要求を返す = FR-020）
- [X] T016 [US1] 転送トリガーを実装する: `mobile/src/features/sync/triggers.ts`（AppState フォアグラウンド復帰・expo-network の通信回復・手動。`app/_layout.tsx` で起動時に接続）
- [X] T017 [US1] ログ作成画面を実装する: `mobile/app/(tabs)/new.tsx` + `mobile/src/features/dives/components/DiveForm/`（`@repo/core` の yup スキーマで検証・保存は DAL への書き込みのみ = 圏外で完了。保存後は一覧へ。jest-expo テスト同梱: 必須項目エラー・保存呼び出し）
- [X] T018 [US1] 転送状態の確認 UI を実装する: 一覧ヘッダーの同期ステータス（転送待ち n 件・進捗・最終結果）と失敗ログの理由表示 + 手動再転送ボタン（FR-003/006。`mobile/src/features/sync/components/SyncStatusBar/`。jest-expo テスト同梱）
- [ ] T019 [US1] quickstart.md シナリオ 1（1〜6）を実機/シミュレータで検証する（機内モード作成・強制終了耐性・自動転送・冪等性・失敗系）

**Checkpoint**: US1 単独でデモ可能（MVP）。Web のログ一覧にモバイル作成分が現れる

---

## Phase 4: User Story 2 - モバイルでのログ閲覧とダウンロード (Priority: P2)

**Goal**: ログ一覧・詳細の閲覧（cache-first）と「オフライン用に同期」（全件一括）

**Independent Test**: quickstart.md シナリオ 2（オンライン閲覧・全件同期 → 機内モードで 100% 閲覧・未同期案内）

### Tests for User Story 2（実装より先に書き、失敗を確認する）

- [X] T020 [P] [US2] 全件同期ロジックの Vitest を先行作成する: `mobile/src/features/sync/lib/fullSync.test.ts`（keyset ページングの繰り返し取得 → cached 全件置換 → last_full_sync_at 更新 / 途中失敗時は置換しない）

### Implementation for User Story 2

- [X] T021 [US2] 全件同期を実装する: `mobile/src/features/sync/lib/fullSync.ts` + 設定画面の「オフライン用に同期」ボタン（進捗・最終同期日時表示。T020 を green にする）
- [X] T022 [US2] ログ一覧画面を実装する: `mobile/app/(tabs)/index.tsx` + `mobile/src/features/dives/components/DiveList/`（DAL の統合クエリで cached ∪ pending を日付降順表示・状態バッジ = FR-014・オンライン時は表示分を機会的リフレッシュ・未同期 × 圏外の案内 = FR-013。jest-expo テスト同梱）
- [X] T023 [US2] ログ詳細画面を実装する: `mobile/app/dives/[id].tsx` + `mobile/src/features/dives/components/DiveDetail/`（cached / pending 両対応・pending は「未転送・編集不可」明示 = FR-009。jest-expo テスト同梱）
- [ ] T024 [US2] quickstart.md シナリオ 2（1〜5）を実機/シミュレータで検証する

**Checkpoint**: US1 + US2 が独立して動作。圏外で「書く + 見る」が完結

---

## Phase 5: User Story 3 - ログのエクスポート (Priority: P3)

**Goal**: オンライン時に既存 Web 基盤で CSV / PDF を生成し、端末保存・共有シートへ

**Independent Test**: quickstart.md シナリオ 3（CSV/PDF 生成・共有・圏外案内・転送待ち対象外の案内）

### Tests for User Story 3（実装より先に書き、失敗を確認する）

- [X] T025 [P] [US3] エクスポートルートの Bearer 認証テストを先行作成する: `service-front/src/app/(authenticated)/dives/export/route.test.ts`（既存テストがあれば追加）— Bearer 有効 = 200 / 無効トークン = 401 / cookie 認証の既存動作維持

### Implementation for User Story 3

- [X] T026 [US3] エクスポートルートに Bearer 認証を追加する: `service-front/src/app/(authenticated)/dives/export/route.ts`（Authorization ヘッダーのトークンで supabase サーバークライアントを構成。cookie 認証は維持。T025 を green にする）。`specs/014-log-export/contracts/export-endpoint.md` に Bearer 対応を追記
- [X] T027 [US3] モバイルのエクスポート機能を実装する: `mobile/src/features/export/`（形式・範囲選択 → Bearer 付き取得 → expo-file-system 保存 → expo-sharing 共有。圏外時は案内 = Q3、転送待ちログは対象外の案内 = US3-AC3）+ 設定画面への組み込み。jest-expo テスト同梱
- [ ] T028 [US3] quickstart.md シナリオ 3（1〜4）を実機/シミュレータで検証する

**Checkpoint**: 全ストーリーが独立して動作

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T029 [P] Google ログインを追加する: `mobile/app/(auth)/login.tsx` に expo-auth-session + ディープリンク（PKCE）で Google 導線を追加（FR-018。Supabase 側のリダイレクト URL 設定手順も quickstart.md に追記）
- [X] T030 [P] a11y 監査: 全画面の accessibilityRole / accessibilityLabel / 44pt ターゲット / 状態の色+テキスト表現 / 動的フォント追従を確認・修正（contracts/app-screens.md の a11y 節）
- [X] T031 CI へ mobile / packages-core を追加する: `.github/workflows/ci.yml` に `npm run test --workspace packages/core` / mobile の Vitest + jest-expo + `tsc --noEmit` / biome 対象化のジョブを追加
- [ ] T032 quickstart.md の全シナリオ（1〜4）を通しで検証する（認証・データ保護のシナリオ 4 を含む）
- [X] T033 全体チェック: `npm run check`（biome）/ 各ワークスペースの test / tsc をすべてパスさせ、`/sync-spec` で `specs/029-mobile-offline-logs/` を実装に同期する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（Setup）**: 依存なし。T001→T002 は順序必須、T003 完了後に T004/T005/T006 が並列可
- **Phase 2（Foundational）**: Phase 1 完了後。**全ストーリーをブロック**（T007→T008、T009→T010）
- **Phase 3（US1）**: Phase 2 完了後
- **Phase 4（US2）**: Phase 2 完了後（US1 と並行可能だが、T022 の同期ステータス表示は T018 と同一画面のため単独作業なら US1 → US2 が安全）
- **Phase 5（US3）**: T025-T026（Web 側）は Phase 1 完了後いつでも並行可。T027 は Phase 2 + 設定画面（T021）以降
- **Phase 6（Polish）**: 全ストーリー完了後（T029/T031 は早めの並行も可）

### Within Each User Story

- Vitest 先行（Red）→ 純粋ロジック実装（Green）→ ランナー / 画面 → quickstart 検証
- RN コンポーネントは実装と同時に jest-expo テストを同梱（/generate-with-tests は Web 専用スキルのため使わない）

### Parallel Opportunities

- T004 / T005 / T006（Setup 後半）、T011 / T012（US1 テスト先行）は並列可
- Web 側の T025-T026（US3）はモバイル実装全体と並行可能
- T029（Google ログイン）/ T031（CI）は他タスクと独立

---

## Parallel Example: User Story 1

```bash
# テスト先行（2 つ並列）:
Task: "packages/core/src/lib/diveTransfer.test.ts に変換のテストを作成"
Task: "mobile/src/features/sync/lib/syncMachine.test.ts に状態機械のテストを作成"

# 実装（変換とコアは並列 → ランナーは両方の完了後）:
Task: "diveTransfer.ts を実装"
Task: "syncMachine.ts を実装"
```

---

## Implementation Strategy

### MVP First（User Story 1 のみ）

1. Phase 1 → Phase 2 → Phase 3（US1）
2. **STOP and VALIDATE**: quickstart シナリオ 1（機内モード → 自動転送 → Web 反映・二重登録ゼロ）
3. この時点で「現場で書いて、帰ったら Web に揃っている」が成立（デモ可能）

### Incremental Delivery

1. Setup + Foundational → ログインと空の一覧
2. US1 → MVP デモ（オフライン作成 + 転送）
3. US2 → 閲覧・全件同期（圏外で書く + 見るが完結)
4. US3 → エクスポート
5. Polish（Google ログイン・a11y・CI・通し検証・仕様同期）

---

## Notes

- サーバー側マイグレーションは無い（data-model.md §0）。ローカル Supabase の reset は他セッションと調整（共有スタック）
- Expo / RN のバージョンは scaffold 時点の最新安定に固定し、plan.md の Technical Context へ追記する
- コミットはタスクまたは論理グループ単位。コミット前に biome check（レビュー修正ルール）
