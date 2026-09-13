# Implementation Plan: ログ枠の有料化（デイリーボーナス + 買い切りログパック）

**Branch**: `026-log-monetization` | **Date**: 2026-07-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/026-log-monetization/spec.md`

## Summary

ダイビングログの新規作成を「ログ枠（クレジット）」の消費で管理する。枠の増減はすべて追記専用のレジャー（`log_credit_ledger`）に記録し、残高テーブル（`log_credit_balances`、`check (balance >= 0)`）と常に一致させる（FR-016）。**消費の強制は `public.dives` への AFTER INSERT トリガー**で行い（ledger の dive_id FK が行の存在を要求するため。同一トランザクションなので原子性は保たれる）、`createDive`・`createDiveFromPlan`（024）を含むすべての作成経路で原子的に 1 枠を消費、残枠 0 なら作成を拒否する（FR-001/002/012、同時多重リクエスト対策）。デイリーボーナスは認証済みレイアウトから冪等 RPC `grant_daily_bonus()` を呼び、JST 暦日ごとに 1 回だけ自動付与する（FR-003、ユニーク制約で二重付与防止）。購入は **Stripe Checkout（一回払い、お試し 10 枠 480 円 / おすすめ 30 枠 1,200 円 / たっぷり 100 枠 3,000 円の 3 パック）** を採用し、Server Action で選択パックの Checkout Session を作成（`metadata.pack_id` で webhook がパックを判別） → Stripe webhook（`/api/stripe/webhook`）で決済完了を検証してから枠を付与する（FR-005/007、セッション ID ユニーク制約で冪等）。初期枠 10 は新規ユーザーは既存 `handle_new_user` トリガーの拡張、既存ユーザーはマイグレーションのバックフィルで付与する（FR-008）。残枠はヘッダー/ログ作成導線に表示し、購入・履歴ページを `/settings/log-credits` に新設する。広告は導入しない（FR-015、実装作業なし＝方針の明文化のみ）。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router / React（React Compiler）

**Primary Dependencies**: 新規: `stripe`（サーバー SDK。Checkout Session 作成と webhook 署名検証のみに使用、クライアント SDK は不要）。既存再利用: Supabase（Auth + PostgreSQL + RLS）、TanStack Query（残枠のクライアント更新）、React Hook Form + yup、Tailwind、`todayInJst`（shared/lib/date）

**Storage**: Supabase（PostgreSQL）。新規テーブル 3: `log_credit_ledger`（追記専用の増減記録）/ `log_credit_balances`（残高キャッシュ）/ `log_credit_purchases`（購入記録）。新規関数: `grant_daily_bonus()` / `consume_log_credit()`（dives AFTER INSERT トリガー）/ `apply_credit_ledger_entry()`。既存変更: `handle_new_user` に初期枠付与を追加

**Testing**: Vitest（枠計算・冪等付与・webhook ハンドラ・Server Action・残枠表示コンポーネント）、Storybook（残枠バッジ・購入カード・残枠 0 バナー）、Playwright + axe-core（購入導線・残枠 0 ブロックの E2E は Stripe テストモード / モックで）

**Target Platform**: Web（service-front）。決済は Stripe Checkout のホスト型ページ（アプリストア課金は対象外）

**Project Type**: Web application（service-front + Supabase マイグレーション + Stripe 連携）

**Performance Goals**: 決済成功から残枠反映まで 1 分以内（SC-003、webhook 駆動で通常数秒）。デイリーボーナス判定はリクエストあたり追加クエリ 1 回以内

**Constraints**: 残高は負にならない（DB 制約で保証）。枠付与は決済成功後のみ・冪等（webhook リトライ / 重複イベントで二重付与しない）。日付判定は JST 暦日。既存ログ・編集・削除・エクスポートは枠消費なし（トリガーは INSERT のみ）。ログ削除で枠は返却しない。返金は未消費分を上限に残高から差し引き、0 で床打ち

**Scale/Scope**: 新規 feature `credits`（features/credits: server/components/lib/constants）、新規ページ 1（`/settings/log-credits`）+ 決済結果導線、新規 API route 1（`/api/stripe/webhook`）、マイグレーション 2〜3 本、既存変更: `DiveForm` 残枠 0 ブロック表示・authenticated layout（ボーナス RPC 呼び出し）・`seed.sql`（テストユーザーへの枠付与）。対象外: 複数パック / 価格変更 UI、サブスク、アプリ内返金申請、広告、admin-front の購入管理画面（将来対応）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 準拠状況 |
|------|---------|
| I. Spec-Driven Development | spec（clarify 3 件回答済み）→ plan の順で確定。違反なし |
| II. Server Components First | 残枠表示・購入ページ・履歴は Server Component でフェッチ。Client は購入ボタン（Checkout リダイレクト）・残枠 0 バナーの最小範囲。決済確定は webhook（route handler）と Server Action。違反なし |
| III. Test-First | DB 関数はマイグレーション前に期待挙動を quickstart / Vitest（RPC 呼び出しの結果検証）で定義。新規コンポーネントは `/generate-with-tests` で test/story/a11y を同梱。違反なし |
| IV. Security & RLS by Default | 新規 3 テーブルすべて RLS 有効。ledger / balances / purchases は本人 select のみ・**クライアントからの書き込みは全面禁止**（付与・消費は security definer 関数 + トリガー経由、webhook は service_role）。全関数 `set search_path = ''`。金額・数量はサーバー側定義のみ（クライアント入力を信用しない）。webhook は Stripe 署名検証必須。違反なし |
| V. Accessibility（WCAG 2.1 AA） | 残枠 0 の作成ブロックは `role="alert"` で通知し、購入導線へキーボード到達可能。残枠バッジはテキスト併記（色のみに依存しない）。購入ボタンは 44px。違反なし |
| VI. Coding Standards | snake_case / 3NF（レジャーが正・残高は性能目的の冗長でトリガー整合＝sql.md の非正規化ルールに従い理由コメント）/ timestamptz / Feature-based（credits feature 新設）。違反なし |

**判定**: 違反なし。Complexity Tracking 記載不要。

## Project Structure

### Documentation (this feature)

```text
specs/026-log-monetization/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0: 決済プロバイダ / 消費の強制方式 / 冪等性設計
├── data-model.md        # Phase 1: 3 テーブル + 関数/トリガー + RLS
├── quickstart.md        # Phase 1: 検証手順（ボーナス / 消費 / 購入 / 冪等性）
├── contracts/
│   ├── server-actions.md   # createCheckoutSession / getCreditBalance 等の契約
│   ├── stripe-webhook.md   # webhook イベント処理・冪等性・失敗時挙動の契約
│   └── ui.md               # 残枠表示・残枠 0 ブロック・購入/履歴ページの契約
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks 出力（本コマンドでは未生成）
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   ├── <ts>_create_log_credits.sql         # ★新規: 3 テーブル + RLS + 関数/トリガー + 既存ユーザーへ初期枠 10 バックフィル
│   └── <ts>_alter_handle_new_user_grant_initial_credits.sql  # ★新規: 新規ユーザーへ初期枠 10
└── seed.sql                                # ★変更: テストユーザーへ枠付与（dives seed が トリガーで枯渇しないよう先行付与）

service-front/src/
├── app/
│   ├── (authenticated)/
│   │   ├── layout.tsx                      # ★変更: grant_daily_bonus RPC を冪等呼び出し（FR-003）
│   │   └── settings/log-credits/page.tsx   # ★新規: 残枠 + 購入 + 購入履歴ページ（決済結果 searchParams 受理）
│   └── api/stripe/webhook/route.ts         # ★新規: 署名検証 → 購入確定 → 枠付与（冪等）
├── features/credits/                       # ★新規 feature
│   ├── constants.ts                        # パック定義（LOG_CREDIT_PACKS: 10/30/100 枠）・Stripe 関連定数
│   ├── server/
│   │   ├── queries.ts                      # getCreditBalance / getPurchaseHistory
│   │   └── actions.ts                      # createCheckoutSession（Server Action）
│   ├── lib/
│   │   └── stripe/                         # Stripe クライアント初期化 + webhook イベント→付与のドメイン処理（+ test/index）
│   └── components/
│       ├── server/CreditBalanceBadge/      # ★新規: 残枠表示（ヘッダー / ログ作成導線）
│       ├── client/PurchasePackCard/        # ★新規: パック購入カード（Checkout へ遷移）
│       └── client/NoCreditBanner/          # ★新規: 残枠 0 時の案内（role="alert" + 購入導線）
└── features/dives/
    ├── server/actions.ts                   # ★変更: 枠不足エラー（トリガー由来）を判別しユーザー向けメッセージへ変換
    ├── hooks/useDiveFormSubmit.ts          # ★変更: 枠不足エラー分岐（+ test 同期）
    └── components/client/DiveForm/         # ★変更: 残枠 0 時の送信ブロック表示（+ test/story 同期）
```

**Structure Decision**: 枠・購入は横断的な収益ドメインだが、現時点の消費対象はログのみ。将来の拡張（海洋データ販売等）を見据えて独立した `features/credits` に切り出し、dives feature へは「枠不足エラーの翻訳」という最小の接点だけを持たせる。**消費ロジックを DB トリガーに置く**ことで、dives feature 側は枠の存在をほぼ意識せず（アプリ層での枠チェック分岐を持たず）、全作成経路の取りこぼしを構造的に防ぐ。残枠バッジは Server Component とし、購入後の即時反映は決済結果ページ経由の再フェッチで実現する。

## Phase 0: Research

主要な設計判断は [research.md](research.md) に集約する。要点:

1. **決済プロバイダ: Stripe Checkout（一回払い）** — ホスト型決済ページで JPY・カード対応、PCI 負担なし、webhook + テストモードが揃う。Payment Links は履歴との突合が弱く、国産 PSP はエコシステムで劣後。
2. **消費の強制方式: `dives` BEFORE INSERT トリガー** — アプリ層チェックは経路追加時の取りこぼしと TOCTOU 競合があるため不採用。トリガー + 残高行ロック + `check (balance >= 0)` で「残枠 1 で同時 2 リクエスト」でも超過作成が起きない。
3. **残高の持ち方: レジャー（正）+ 残高キャッシュ（冗長）** — 都度 SUM は表示経路で高コスト。残高更新はレジャー insert と同一トランザクション内の共通関数に限定し、FR-016 の検証可能性を保つ。
4. **冪等性: 一意制約で担保** — デイリーボーナスは `(user_id, granted_on)` 部分ユニーク、購入付与は `stripe_checkout_session_id` ユニーク + 付与済みフラグ。リトライ・重複 webhook・多重タブに対して安全。
5. **デイリーボーナスの呼び出し点: authenticated layout** — 「その日はじめての訪問で自動付与」を全認証ページ共通で満たす唯一の場所。付与済みならインデックス 1 回の no-op。
6. **返金の扱い: `charge.refunded` webhook で調整エントリ** — 未消費分を上限に差し引き 0 で床打ち（spec Edge Case）。

## Phase 1: Design & Contracts

- **データモデル**: [data-model.md](data-model.md) — `log_credit_ledger` / `log_credit_balances` / `log_credit_purchases` の定義、`grant_daily_bonus` / `consume_log_credit`（トリガー）/ `apply_credit_ledger_entry` 関数、RLS（本人 select のみ・書き込みは関数経由）、既存ユーザーバックフィル。
- **契約**:
  - [contracts/server-actions.md](contracts/server-actions.md) — `createCheckoutSession()`・`getCreditBalance()`・`getPurchaseHistory()` の入出力と失敗系。
  - [contracts/stripe-webhook.md](contracts/stripe-webhook.md) — `checkout.session.completed` / `charge.refunded` の処理契約・署名検証・冪等性・リトライ応答。
  - [contracts/ui.md](contracts/ui.md) — 残枠バッジ・残枠 0 バナー・購入カード・履歴一覧・DiveForm ブロックの表示/文言/a11y 契約。
- **検証手順**: [quickstart.md](quickstart.md) — ローカル（Stripe CLI の webhook 転送 + テストカード）でボーナス付与・枠消費・購入・二重付与防止・同時リクエストを検証する手順。
- **Agent context 更新**: `.claude/CLAUDE.md` の `<!-- SPECKIT START -->`〜`<!-- SPECKIT END -->` を本 plan（`specs/026-log-monetization/plan.md`）へ更新。

**Post-Design Constitution Re-check**: 新規テーブルはすべて RLS + 関数経由書き込みで原則 IV に適合。トリガー採用によりアプリ層の複雑化を回避し、Client Component は購入操作の最小範囲のみ。違反なし。
