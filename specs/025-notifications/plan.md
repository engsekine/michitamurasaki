# Implementation Plan: 通知機能（アプリ内通知）

**Branch**: `025-notifications` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/025-notifications/spec.md`

## Summary

既存のソーシャル機能（021 フォロー / バディタグ）と時限性機能（004/024 ダイビング予定、003 レギュレーター OH）に対するアプリ内通知を追加する。

技術方針（research.md で確定）:

1. **ソーシャル通知は DB トリガーで生成**: `user_follows` / `dive_log_buddies` の INSERT に AFTER トリガーを張り、PostgREST 直叩きを含むすべての経路で漏れなく通知を生成する（プロジェクトで確立済みの DB 側防御方針に一致）
2. **リマインド通知はアクセス時の遅延生成**: cron 基盤を追加せず、TOP / 通知一覧の表示時に本人分の「予定日当日」「OH 期限到来」を冪等 upsert する。OH 期限の月末丸めは既存 `overhaul.ts` のロジックを再利用するため app 層が適切
3. **集約と既読維持は unique 制約 + upsert**: 同一（受信者・種別・相手・対象）の通知は 1 行に集約し、再発生時は発生日時のみ更新して `read_at` を維持する（Clarification Q3）
4. **未読バッジは Header の Server Component**: 部分インデックス付きの count クエリのみ。リアルタイム配信はしない（spec Assumption）

`public` スキーマに新テーブル 2 つ（`notifications` / `notification_preferences`）を追加し、RLS で本人限定にする（FR-014）。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router（React 19 + React Compiler）

**Primary Dependencies**: Supabase（`@supabase/ssr` + supabase-js）。フォームは通知設定のトグルのみで React Hook Form 不要（既存 `TwoFactorSettings` と同じ素の Server Action 呼び出しパターン）

**Storage**: Supabase PostgreSQL。新規テーブル `notifications` / `notification_preferences`（RLS 必須）。生成トリガー 2 本（security definer / `set search_path = ''`）

**Testing**: Vitest（サーバーアクション・クエリ・判定ロジックの単体）、Storybook（新規 client コンポーネント）、Playwright + axe-core（a11y）。トリガー・RLS は quickstart.md の手動検証 + 既存 db-lint CI で担保

**Target Platform**: Web（service-front）。admin-front への変更なし

**Project Type**: Web アプリケーション（既存 Feature-based 構成への追加）

**Performance Goals**: 未読バッジの count は全認証ページで実行されるため部分インデックスで O(未読数)。通知 1,000 件でも一覧初回表示 2 秒以内（SC-004。keyset ページング 20 件/頁）

**Constraints**: リアルタイム配信なし（画面表示時に最新であれば良い）。メール / プッシュ通知はスコープ外。通知保持 90 日（本人アクセス時に遅延削除）

**Scale/Scope**: 通知種別 4 種・画面 2 枚（通知一覧 / 通知設定）+ ヘッダーバッジ。初期ユーザー規模は小

## Constitution Check

*GATE: Phase 0 前に通過必須。Phase 1 設計後に再評価。*

| 原則 | 判定 | 対応方針 |
|------|------|----------|
| I. Spec-Driven Development | PASS | spec → clarify（3 問確定済み）→ plan の順で進行 |
| II. Server Components First | PASS | 通知一覧ページ・バッジは Server Component。Client は既読操作（`NotificationList`）と設定トグル（`NotificationSettings`）の最小範囲。ページは `generatePageMetadata` を使用 |
| III. Test-First（テスト同梱） | PASS | サーバーアクション / クエリ / 集約・リマインド判定ロジックは Vitest 先行。新規 client コンポーネントは Vitest + Storybook + a11y 同梱。トリガー・RLS はユニット不能のため quickstart 手動検証で代替（明記） |
| IV. Security & RLS by Default | PASS | 両テーブル RLS 有効・`(select auth.uid())` ベースで本人限定（FR-014 / SC-005）。生成トリガーは security definer + `set search_path = ''`。UPDATE は read_at の変更のみ許可するガードトリガー（021 buddy ガードと同型）。マイグレーション経由のみ |
| V. Accessibility（WCAG 2.1 AA） | PASS | バッジは `aria-label`（例: 「通知 3 件の未読」）、一覧はセマンティックなリスト + 見出し階層、既読操作はボタン、空状態テキスト。設定トグルは既存パターン（label 関連付け + `role="alert"`） |
| VI. Coding Standards | PASS | 新規 `features/notifications/`（Feature-based）、snake_case / 3NF / timestamptz / CHECK 制約（sql.md）、コンポーネントフォルダ 3 点構成 |

**GATE 結果**: 違反なし。Complexity Tracking への記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/025-notifications/
├── plan.md              # This file
├── research.md          # Phase 0 output（生成方式・集約・保持の決定）
├── data-model.md        # Phase 1 output（notifications / notification_preferences / トリガー / RLS）
├── quickstart.md        # Phase 1 output（手動検証シナリオ）
├── contracts/           # Phase 1 output
│   ├── server-and-queries.md   # サーバーアクション / クエリ契約
│   └── ui-and-routes.md        # 画面・ルート・遷移先マップ
└── tasks.md             # /speckit-tasks で作成（本コマンドでは作らない）
```

### Source Code (repository root)

```text
supabase/migrations/
├── <ts>_create_notifications.sql            # テーブル 2 つ + RLS + インデックス + ガードトリガー
└── <ts>_add_notification_triggers.sql       # user_follows / dive_log_buddies の生成トリガー

service-front/src/
├── features/notifications/                   # 新規 feature
│   ├── constants.ts                          # 種別・ラベル・ページサイズ・保持日数・バッジ上限
│   ├── lib/
│   │   ├── notificationTarget/               # 通知 → 遷移先 URL 解決（消滅時フォールバック / FR-012）
│   │   └── reminderDue/                      # 予定当日 / OH 期限到来の判定（overhaul の期限計算を利用）
│   ├── server/
│   │   ├── queries.ts                        # listNotifications / getUnreadNotificationCount /
│   │   │                                     # ensureTimedNotifications（リマインド upsert + 90 日清掃）
│   │   └── actions.ts                        # markNotificationRead / markAllNotificationsRead /
│   │                                         # setNotificationPreference
│   ├── lib/notificationDisplay/              # 表示ヘルパー（メッセージ組み立て・JST 日付・退会判定。feat/design-change で切り出し）
│   └── components/
│       ├── server/NotificationBell/          # ヘッダーの通知アイコン。未読件数 + 最新ページを取得しパネルに注入（feat/design-change で変更）
│       └── client/
│           ├── NotificationBellPanel/        # ベル + シートパネル（feat/design-change で追加。タップ既読 → 遷移）
│           ├── NotificationList/             # 一覧（タップ既読 + すべて既読 + 追加読み込み）
│           └── NotificationSettings/         # 種別ごとの ON/OFF
├── app/(authenticated)/notifications/page.tsx           # 通知一覧ページ（新規）
├── app/(authenticated)/settings/notifications/page.tsx  # 通知設定ページ（新規）
└── features/auth/components/client/AuthNav/  # NotificationBell の導線を追加（Header の actions 経由）
```

**Structure Decision**: 021（social）・023（mfa）と同じく独立 feature `notifications/` に切り出す。フォロー / バディ / 予定 / 機材を横断する機能でありどの既存 feature にも属さないため。DB 生成トリガーはマイグレーション所管、リマインド生成と表示は service-front 所管。admin-front は変更しない。

## 設計詳細

### 通知の生成経路（4 種別）

| 種別 | 生成タイミング | 生成主体 | 集約キー |
|------|--------------|---------|---------|
| `followed` | `user_follows` INSERT 時 | DB トリガー（definer） | 受信者 × 相手 |
| `buddy_tagged` | `dive_log_buddies` INSERT 時（`buddy_user_id` あり） | DB トリガー（definer） | 受信者 × ログ |
| `plan_reminder` | TOP / 通知一覧の表示時（遅延生成） | `ensureTimedNotifications`（app） | 受信者 × 予定 × 予定日 |
| `overhaul_reminder` | 同上 | 同上 | 受信者 × 機材 × 期限日 |

- トリガーは `notification_preferences` に OFF 行があれば生成しない（FR-011）。リマインドは app 層で同様にチェック
- upsert の on conflict では `occurred_at` のみ更新し `read_at` は維持する（FR-008 / Clarification Q3）
- 90 日超の通知は `ensureTimedNotifications` 内で本人分を削除（FR-013。cron 基盤を追加しない）
- 自己起因の通知（FR-007）は、自己フォロー・自己バディタグが既存の CHECK / トリガーで禁止済みのため新たな考慮不要（トリガー内でも防御的に `recipient <> actor` を確認する）

### 未読バッジ

`AuthNav`（Header の actions として各ページに渡る）に `NotificationBell`（Server Component）を追加。部分インデックス `where read_at is null` 付きの count クエリで未読件数を取得し、10 件以上は「9+」表示（FR-004）。

**feat/design-change（2026-07-08）**: ベルは `/notifications` へのリンクから、押すとシートで通知を確認できる `NotificationBellPanel`（Client）に変更。`NotificationBell` は未読件数に加えて `listNotifications()` の最初のページも取得してパネルに注入する（全認証ページで count + 一覧クエリの 2 本）。シート内の通知タップは `markNotificationRead` → 遷移（NotificationList と同方針）、全件・すべて既読は `/notifications` に残置。表示ヘルパーは `lib/notificationDisplay` に切り出して両者で共用。

### 既読操作と一覧

- 通知タップ = `markNotificationRead(id)` を実行してから遷移（Client Component。`useTransition` の既存パターン）
- 「すべて既読にする」= `markAllNotificationsRead()`
- 一覧は `occurred_at` の keyset ページング（021 タイムラインと同型）で 20 件ずつ
- RLS: UPDATE は本人行のみ + ガードトリガーで `read_at` 以外の変更を拒否（改ざん防止）

## Complexity Tracking

> Constitution Check に違反がないため記載不要。
