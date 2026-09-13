# Tasks: 通知機能（アプリ内通知）

**Input**: Design documents from `specs/025-notifications/`

**Prerequisites**: plan.md, spec.md（Clarifications 3 件確定済み）, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Constitution III（Test-First）に従い、サーバーアクション / クエリ / lib は Vitest 先行、新規コンポーネントは Vitest + Storybook + a11y を同梱する（`/generate-with-tests` 利用可）。トリガー・RLS は quickstart.md の手動検証で担保。

**Organization**: ユーザーストーリー単位（US1 ソーシャル通知 = MVP / US2 リマインド / US3 通知設定）。各ストーリーは独立して実装・検証・デリバリー可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（別ファイル・未完了タスクへの依存なし）
- **[Story]**: US1 / US2 / US3（Setup・Foundational・Polish には付けない）

## Phase 1: Setup

**Purpose**: ルーティングと feature の骨格

- [X] T001 [P] `service-front/src/proxy.ts` の `APP_ROUTE_PREFIXES` に `/notifications` を追加（`/settings/notifications` は既存の `/settings` で保護済み。コメントも更新）
- [X] T002 [P] `service-front/src/features/notifications/constants.ts` を作成: `NotificationType` union（'followed' | 'buddy_tagged' | 'plan_reminder' | 'overhaul_reminder'）・種別ラベル / 文言テンプレート（contracts/ui-and-routes.md の 4 文言）・`NOTIFICATIONS_PAGE_SIZE = 20`・`NOTIFICATION_RETENTION_DAYS = 90`・`UNREAD_BADGE_MAX = 9`

**Checkpoint**: feature ディレクトリと定数が存在し、型が通る

## Phase 2: Foundational（全ストーリーのブロッカー）

**Purpose**: テーブル・RLS・型。これが無いとどのストーリーも動かない

- [X] T003 マイグレーション `supabase/migrations/<ts>_create_notifications.sql` を作成: `notifications` / `notification_preferences` テーブル + CHECK + 式 unique インデックス（集約キー）+ `idx_notifications_recipient_occurred` + 部分インデックス `idx_notifications_unread` + RLS（本人限定の select / insert / update / delete）+ UPDATE ガードトリガー（read_at のみ変更可。021 の enforce_buddy_optout_only_update と同型）+ `notification_preferences` の handle_updated_at トリガー。定義は data-model.md A / B 節が正。`supabase db reset` で適用を確認
- [X] T004 `packages/supabase/src/types.ts` の Database 型を再生成（`supabase gen types typescript --local`）し、`notifications` / `notification_preferences` が含まれることを確認。両ワークスペースの type-check を通す

**Checkpoint**: `supabase db reset` 成功・Database 型に新テーブルが存在

## Phase 3: User Story 1 - ソーシャルイベントのアプリ内通知 (P1) 🎯 MVP

**Goal**: フォロー / バディタグの通知が生成され、ベルのバッジ → 一覧 → タップ既読 / 全既読が動く

**Independent Test**: quickstart.md シナリオ 1（B のフォロー / バディタグ → A のバッジ・一覧・既読）とシナリオ 4（直叩きで他人の通知が読めない・改ざんできない）

### DB（通知の生成）

- [X] T005 [US1] マイグレーション `supabase/migrations/<ts>_add_notification_triggers.sql` を作成: `notify_on_follow`（after insert on user_follows）と `notify_on_buddy_tag`（after insert on dive_log_buddies）。security definer + `set search_path = ''`・preferences の OFF 行チェック・自己通知の防御・on conflict で occurred_at のみ更新（read_at 維持）。定義は data-model.md C 節が正。`supabase db reset` + `supabase db lint` で確認

### サーバー層（テスト先行）

- [X] T006 [P] [US1] `service-front/src/features/notifications/server/queries.test.ts` を作成: listNotifications（20 件 + nextCursor・keyset 境界・actor 退会で nickname null）/ getUnreadNotificationCount（失敗時 0）。実装前に FAIL を確認
- [X] T007 [P] [US1] `service-front/src/features/notifications/server/actions.test.ts` を作成: markNotificationRead（既読化・0 行でも成功・recipient 条件付き）/ markAllNotificationsRead。実装前に FAIL を確認
- [X] T008 [US1] `server/queries.ts` に `listNotifications` / `getUnreadNotificationCount` を実装（契約: contracts/server-and-queries.md。requireUser + `eq('recipient_id', user.id)` の二重防御・`get_user_public_profiles` で nickname 解決。T006 に依存）
- [X] T009 [US1] `server/actions.ts` に `markNotificationRead` / `markAllNotificationsRead` を実装（T007 に依存）

### lib

- [X] T010 [P] [US1] `lib/notificationTarget/`（notificationTarget.ts + test + index.ts）を作成: 種別 → 遷移先 URL の解決と actor 退会時の無効化判定（契約: contracts/ui-and-routes.md の遷移先マップ）。テスト先行

### UI

- [X] T011 [P] [US1] `components/server/NotificationBell/`（本体 + test + index.ts）を作成: 未読 count 表示（0 は非表示 / 1〜9 / 「9+」）・`aria-label="通知（未読 N 件）"`・`/notifications` へのリンク
- [X] T012 [P] [US1] `components/client/NotificationList/`（本体 + test + stories + index.ts）を作成: 未読の視覚区別（色以外の手掛かり併用）・タップで markNotificationRead → 遷移・「すべて既読にする」・「さらに読み込む」（keyset）・退会ユーザー表示・空状態。`/generate-with-tests` 利用可
- [X] T013 [US1] `service-front/src/app/(authenticated)/notifications/page.tsx` を作成: `generatePageMetadata`・h1「通知」・listNotifications の初回 20 件を NotificationList へ（T008 / T012 に依存）
- [X] T014 [US1] `service-front/src/features/auth/components/client/AuthNav/` に NotificationBell の導線を追加し、AuthNav の test / stories を同期
- [X] T015 [US1] `service-front/src/features/notifications/index.ts` を作成（バレル: NotificationBell / NotificationList と server の公開 API を re-export。client からの server 直接 import は既存方針どおり server/actions 直接パスで可）

### 検証

- [ ] T016 [US1] quickstart.md シナリオ 1（ソーシャル通知一式）とシナリオ 4（セキュリティ直叩き）を実行して確認（※ トリガー・集約・既読維持・設定 OFF・UPDATE ガードは実 DB の SQL 検証で確認済み。ブラウザ通し操作と PostgREST 直叩きは未実施）

**Checkpoint**: US1 が単独で機能・検証可能（MVP）

## Phase 4: User Story 2 - 予定・メンテナンスのリマインド通知 (P2)

**Goal**: 予定日当日と OH 期限到来の通知が「1 回だけ」遅延生成される

**Independent Test**: quickstart.md シナリオ 2（当日予定 / 過去日登録の除外 / OH 期限 / 移動済みフォールバック）

- [X] T017 [P] [US2] `lib/reminderDue/`（reminderDue.ts + test + index.ts）を作成: 予定の当日判定（`plannedOn === todayInJst()` かつ登録日 <= 予定日 / FR-009）と OH 期限到来判定（`features/dashboard/lib/overhaul.ts` の期限計算を利用し期限日 <= 今日）。dedup_key（期限日文字列）の導出もここ。テスト先行
- [X] T018 [US2] `server/queries.test.ts` に ensureTimedNotifications のテストを追加: 当日予定 → upsert / 過去日登録予定 → 生成なし / OH 期限 → upsert / 設定 OFF → スキップ / 90 日超の削除（FR-013）。実装前に FAIL を確認
- [X] T019 [US2] `server/queries.ts` に `ensureTimedNotifications` を実装（契約: contracts/server-and-queries.md。on conflict do nothing・失敗はログのみ。T017 / T018 に依存）
- [X] T020 [US2] 呼び出しを結線: `service-front/src/app/page.tsx`（TOP ダッシュボード）と `app/(authenticated)/notifications/page.tsx` の描画前に `ensureTimedNotifications()` を await（既存の TOP テストがあれば同期）
- [ ] T021 [US2] quickstart.md シナリオ 2 を実行して確認（※ 判定ロジック・冪等性は Vitest で確認済み。ブラウザ通し操作は未実施）

**Checkpoint**: US1 + US2 が動作。リマインドが 1 回だけ生成される

## Phase 5: User Story 3 - 通知設定 (P3)

**Goal**: 種別ごとの ON/OFF。OFF の種別は生成されない（生成側のチェックは T005 / T019 で実装済み）

**Independent Test**: quickstart.md シナリオ 3（OFF で生成なし / ON 復帰で遡及なし）

- [X] T022 [P] [US3] `server/actions.test.ts` に setNotificationPreference のテストを追加: upsert・不正 type 拒否（4 値 union のサーバー側検証）。実装前に FAIL を確認
- [X] T023 [US3] `server/actions.ts` に `setNotificationPreference` を実装、`server/queries.ts` に現在の設定取得（`listNotificationPreferences`）を追加（T022 に依存）
- [X] T024 [P] [US3] `components/client/NotificationSettings/`（本体 + test + stories + index.ts）を作成: 4 種別のトグル（label 関連付け・既存 TwoFactorSettings のパターン）・即時保存・失敗 `role="alert"`・「ON に戻しても過去分は届きません」の説明文。`/generate-with-tests` 利用可
- [X] T025 [US3] `service-front/src/app/(authenticated)/settings/notifications/page.tsx` を作成し、通知一覧ページのヘッダー行に設定リンク（歯車）を追加（T023 / T024 に依存）
- [ ] T026 [US3] quickstart.md シナリオ 3 を実行して確認（※ OFF 時の生成スキップは実 DB 検証済み。ブラウザ通し操作は未実施）

**Checkpoint**: 全ストーリー完成

## Phase 6: Polish & Cross-Cutting

- [X] T027 [P] Playwright + axe-core の a11y テストを `/notifications` と `/settings/notifications` に追加（既存の a11y テスト構成に従う）
- [X] T028 [P] 両ワークスペースで `npm run check`（biome）・`npm run type-check`・`npm test`・`npm run lint:markup`（service-front）を通す。`supabase db lint` も確認
- [ ] T029 `/review 025-notifications` と `/sync-spec` を実行し、実装と spec / plan / data-model / contracts のズレを解消。`checklists/requirements.md` を再検証
- [ ] T030 quickstart.md の全シナリオを通しで実行し、SC-001〜SC-006 を確認

## Dependencies

```text
Phase 1 (T001-T002)
  └─→ Phase 2 (T003 → T004)   ← 全ストーリーのブロッカー
        ├─→ Phase 3 / US1 (T005〜T016)  ← MVP。T006/T007/T010/T011/T012 は互いに並列可
        │     └─ T008←T006, T009←T007, T013←T008+T012, T014←T011, T016←全US1
        ├─→ Phase 4 / US2 (T017〜T021)  ← US1 と独立（通知一覧が無くても DB 上は検証可能だが、
        │                                  表示確認は US1 の一覧を使うため後続を推奨）
        └─→ Phase 5 / US3 (T022〜T026)  ← 生成側チェックは T005/T019 に実装済み。UI は独立
Phase 6 (T027-T030) ← 全ストーリー完了後
```

## Parallel Execution Examples

- **US1 内**: T006 / T007 / T010 / T011 / T012 は別ファイルのため同時着手可（T005 のマイグレーション適用後）
- **ストーリー間**: US1 完了後、US2（T017〜）と US3（T022〜）は別ファイル群のため並行開発可
- **Polish**: T027 / T028 は並列可

## Implementation Strategy

1. **MVP = Phase 1〜3（US1）**: ソーシャル通知 + 通知基盤（バッジ・一覧・既読）だけで価値が出る。ここでリリース判断可能
2. US2（リマインド）→ US3（設定）の順で増分デリバリー。各 Checkpoint で quickstart の該当シナリオを回す
3. マイグレーション 2 本は既存の書き換えをせず追加のみ（sql.md 準拠）。トリガーのロジック変更が必要になったら新規マイグレーションで再定義する
