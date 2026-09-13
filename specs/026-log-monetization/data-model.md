# Data Model: ログ枠の有料化（026）

新規テーブル 3・コア関数 3・トリガー 2・購入系関数 3・既存関数変更 1。テーブル + コア関数は 1 本目のマイグレーション `create_log_credits.sql` に含める（強い依存関係があるため同一ファイルで OK / sql.md 準拠）。購入系関数は US2 の `add_purchase_functions.sql`、`handle_new_user` の変更は別ファイル。

## テーブル

### log_credit_ledger（枠の増減記録・追記専用・正）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| id | uuid | pk, default gen_random_uuid() | |
| user_id | uuid | not null, references public.users(id) on delete cascade | 対象ユーザー |
| kind | text | not null, check (kind in ('initial_grant', 'daily_bonus', 'purchase', 'consumption', 'refund_adjustment')) | 増減の種別 |
| amount | integer | not null, check (amount <> 0) | 増減数（付与は正・消費/返金調整は負） |
| granted_on | date | nullable | デイリーボーナスの JST 暦日（kind='daily_bonus' のみ必須） |
| dive_id | uuid | nullable, references public.dives(id) on delete set null | kind='consumption' の対象ログ |
| purchase_id | uuid | nullable, references public.log_credit_purchases(id) on delete restrict | kind='purchase' / 'refund_adjustment' の対象購入 |
| stripe_refund_id | text | nullable, unique | 返金調整の冪等キー |
| created_at | timestamptz | not null, default now() | |

- 部分ユニーク: `unique (user_id, granted_on) where kind = 'daily_bonus'` → デイリーボーナスの 1 日 1 回を DB で保証（FR-003）
- kind と参照の整合: `check ((kind = 'daily_bonus') = (granted_on is not null))` / `check (dive_id is null or kind = 'consumption')`（対象ログ削除時の `on delete set null` を許すため「consumption なら必須」は制約にせずトリガー実装で担保） / `check ((kind in ('purchase', 'refund_adjustment')) = (purchase_id is not null))`
- update / delete は想定しない（追記専用）。RLS で書き込みポリシーを作らないことで封じる
- インデックス: `idx_log_credit_ledger_user_id_created_at (user_id, created_at desc)`（履歴表示・検証集計用）

### log_credit_balances（残高キャッシュ・表示/消費判定用）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| user_id | uuid | pk, references public.users(id) on delete cascade | |
| balance | integer | not null, default 0, check (balance >= 0) | 現在の残枠。ledger の sum(amount) と常に一致 |
| updated_at | timestamptz | not null, default now() | トリガーで自動更新 |

- 残枠表示が毎リクエスト発生するため、ledger の都度集計を避ける**性能目的の意図的な非正規化**（理由コメントをマイグレーションに残す / sql.md）
- 更新は `apply_credit_ledger_entry()` 経由のみ。`check (balance >= 0)` が超過消費の最後の防壁

### log_credit_purchases（購入記録）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| id | uuid | pk, default gen_random_uuid() | |
| user_id | uuid | not null, references public.users(id) on delete cascade | 購入者 |
| quantity | integer | not null, check (quantity > 0) | 付与枠数のスナップショット（初期は 10） |
| amount_jpy | integer | not null, check (amount_jpy >= 0) | 支払額のスナップショット（初期は 300） |
| status | text | not null, default 'pending', check (status in ('pending', 'completed', 'failed', 'refunded')) | 決済状態 |
| stripe_checkout_session_id | text | not null, unique | 冪等キー（FR-007） |
| stripe_payment_intent_id | text | nullable | 返金との突合用 |
| credited_at | timestamptz | nullable | 枠付与の完了時刻（付与済み判定） |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | not null, default now() | 既存 `handle_updated_at` トリガーを適用 |

- インデックス: `idx_log_credit_purchases_user_id_created_at (user_id, created_at desc)`（履歴表示）
- quantity / amount_jpy をスナップショット保存することで、将来の価格改定が過去履歴に影響しない（research 7）

## 関数・トリガー

すべて `language plpgsql` / `set search_path = ''`。参照はスキーマ修飾。

### apply_credit_ledger_entry(p_user_id, p_kind, p_amount, ...) → uuid

付与・消費・調整の唯一の書き込み口。`security definer`。

1. `log_credit_balances` の対象行を `insert ... on conflict (user_id) do update` + `for update` で確保・ロック
2. `log_credit_ledger` へ 1 行 insert
3. `balance = balance + p_amount` で更新（負になる場合は `check` 違反で全体ロールバック）

### grant_daily_bonus() → boolean（RPC・authenticated から実行可）

`security definer`。`auth.uid()` の当日（`(now() at time zone 'Asia/Tokyo')::date`）分を冪等に +1。

> **036 改定（2026-07-17）**: 獲得モーダルの表示判定のため、返り値を `void` → `boolean`（付与発生で `true` / 当日分付与済みで `false`）に変更（`20260717100000_alter_grant_daily_bonus_return_granted.sql`、[specs/036-daily-bonus-modal](../036-daily-bonus-modal/data-model.md) 参照）。付与ロジック・冪等性は不変。残高表示は従来どおり `getCreditBalance()` が担う。

### consume_log_credit() → trigger（dives **AFTER INSERT**）

1. `apply_credit_ledger_entry(new.user_id, 'consumption', -1, dive_id := new.id)` を実行
2. 残高不足（check 違反）を捕捉し `raise exception 'ログ枠がありません' using detail = 'no_credit'`（P0001）に変換 → 例外でトランザクション全体がロールバックされ、ログも作られない。アプリ層は error.details = 'no_credit' で判別（独自 errcode は PostgREST が 500 に握りつぶすため使わない）

**AFTER INSERT である理由**: ledger の `dive_id` は `dives(id)` への FK を持つため、行が存在する AFTER でなければ FK 違反になる。同一トランザクション内なので原子性（枠が減るのにログが無い／その逆）は BEFORE と変わらない。導入前の既存行には影響しない（INSERT のみ / FR-009）。UPDATE・DELETE は対象外（FR-010/011）。

### 購入系関数（US2 / `add_purchase_functions.sql`）

| 関数 | 責務 | 冪等性 |
|------|------|--------|
| `create_pending_purchase(p_session_id, p_quantity, p_amount_jpy)` | `auth.uid()` の pending 購入レコードを作成 | session_id ユニーク |
| `complete_purchase(p_session_id, p_payment_intent_id, p_user_id, p_quantity, p_amount_jpy)` | pending 不在時の自己修復作成 → status='completed' + `credited_at` 更新 + `apply_credit_ledger_entry(+quantity)` | `where credited_at is null` の条件付き更新で 1 回のみ付与 |
| `apply_refund(p_payment_intent_id, p_refund_id)` | payment_intent から購入を特定し `min(付与数, 現在残高)` の負値調整 + status='refunded' | `stripe_refund_id` ユニーク |

いずれも `security definer` / `set search_path = ''`。詳細契約は [contracts/stripe-webhook.md](contracts/stripe-webhook.md)。

## 関数の実行権限（CRITICAL）

PostgREST は public スキーマの関数を RPC として公開し、**関数はデフォルトで PUBLIC に execute が付与される**。security definer 関数を放置するとクライアントから `rpc('apply_credit_ledger_entry', ...)` で枠を自己付与できてしまうため、**全関数で execute 権限を明示的に制御する**:

| 関数 | anon | authenticated | service_role |
|------|------|---------------|--------------|
| `apply_credit_ledger_entry` | revoke | **revoke** | grant（他関数からの内部呼び出しは definer 権限で可） |
| `grant_daily_bonus` | revoke | **grant**（本人の当日分のみ操作） | grant |
| `consume_log_credit` | — | —（トリガー専用。revoke all） | — |
| `create_pending_purchase` | revoke | **grant**（`auth.uid()` 必須・本人分のみ作成） | grant |
| `complete_purchase` | revoke | **revoke** | grant（webhook 専用） |
| `apply_refund` | revoke | **revoke** | grant（webhook 専用） |

各マイグレーションで `revoke execute on function ... from public, anon, authenticated;` を先に発行し、必要なロールへだけ `grant execute` する。

### handle_new_user（既存関数の変更・別マイグレーション）

users / user_details 作成に加え、`apply_credit_ledger_entry(new.id, 'initial_grant', 10)` を追加（FR-008）。

## バックフィル（マイグレーション内 DML）

既存ユーザー全員へ `initial_grant` +10 を投入し、`log_credit_balances` を初期化する（FR-008 / spec Assumptions「既存ユーザーも初期枠と同値」）。

## RLS

全テーブルで `enable row level security`。

| テーブル | select | insert / update / delete |
|----------|--------|--------------------------|
| log_credit_ledger | 本人のみ: `(select auth.uid()) = user_id` | ポリシーなし（= 全拒否）。書き込みは security definer 関数のみ |
| log_credit_balances | 本人のみ | ポリシーなし。同上 |
| log_credit_purchases | 本人のみ | ポリシーなし。作成・更新は Server Action（session 作成時）と webhook（service_role、RLS バイパス）のみ |

- 購入レコードの `pending` 作成は Server Action から **service_role ではなく** security definer 関数 `create_pending_purchase()` 経由とする（anon key + RLS の原則を保つ）か、webhook 側で `completed` と同時に upsert する。詳細は contracts/server-actions.md で確定
- ポリシー名は英語の自然文（例: `"users can read own credit balance"`）

## 整合性の検証（FR-016 / SC-004）

`select user_id, sum(amount) from public.log_credit_ledger group by user_id` と `log_credit_balances.balance` の突合クエリを quickstart に含める。テスト（Vitest の RPC 統合テスト）でも消費・付与後の一致を検証する。

## ER 図（関連のみ）

```text
users 1 ─── 1 log_credit_balances
users 1 ─── * log_credit_ledger * ───(nullable) 1 dives
users 1 ─── * log_credit_purchases 1 ─── * log_credit_ledger（purchase / refund_adjustment）
```
