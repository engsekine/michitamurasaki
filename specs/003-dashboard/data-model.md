# Data Model: regulators / get_dive_stats()

003-dashboard が追加するテーブルと RPC。マイグレーション:

- `supabase/migrations/20260611150000_create_regulators.sql`
- `supabase/migrations/20260611150100_create_get_dive_stats.sql`

## ER

```text
users 1 ──── N regulators
（user 削除で機材が連動削除。dives とは FK 関係なし — OH 以降の本数はクエリで集計）
```

## public.regulators

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | |
| `user_id` | `uuid` | NOT NULL, FK → `public.users(id)` `on delete cascade` | 所有者 |
| `brand` | `text` | NOT NULL, `check (length(trim(brand)) > 0 and char_length(brand) <= 60)` | メーカー名 |
| `model` | `text` | NOT NULL, `check (length(trim(model)) > 0 and char_length(model) <= 80)` | モデル名 |
| `purchased_on` | `date` | nullable | 購入日 |
| `last_overhauled_on` | `date` | NOT NULL, `check (>= '1900-01-01' and <= (now() at time zone 'Asia/Tokyo')::date)` | 前回 OH 日。OH 完了記録で今日に更新（JST 基準） |
| `overhaul_interval_months` | `integer` | NOT NULL, `default 12`, `check (> 0)` | OH 推奨周期（月） |
| `overhaul_interval_dives` | `integer` | NOT NULL, `default 100`, `check (> 0)` | OH 推奨周期（本数） |
| `is_primary` | `boolean` | NOT NULL, `default false` | メイン機材フラグ。TOP の表示対象 |
| `notes` | `text` | `check (null or <= 500 文字)` | メモ |
| `created_at` / `updated_at` | `timestamptz` | NOT NULL, `default now()` | updated_at はトリガで自動更新 |

### ユニーク制約・インデックス

```sql
-- 1 ユーザー 1 メイン機材（FR-010）
create unique index regulators_user_id_is_primary_key
    on public.regulators (user_id) where is_primary = true;

-- メイン機材の引き当て用
create index idx_regulators_user_id_is_primary on public.regulators(user_id, is_primary);
```

メイン切り替え時はアプリ側（Server Action）で既存メイン機材を先に解除してから更新する（制約違反防止）。最初の 1 台は `createRegulator` が自動的に `is_primary = true` にする（FR-011）。

### RLS

select / insert / update / delete すべて `(select auth.uid()) = user_id` で本人のみ（4 ポリシー）。

### トリガ

`regulators_handle_updated_at` — `public.handle_updated_at()`（001 定義済み・`set search_path = ''`）を再利用。

## public.get_dive_stats()（RPC）

TOP の累計統計を DB 側で集計する（行数増加に耐えるため。research 相当の判断は plan.md 参照）。

```sql
returns table (total_dives bigint, total_bottom_time_min bigint, max_depth_m numeric, visited_locations bigint)
language sql / stable / security invoker / set search_path = ''
```

- 本人限定は関数内の `where user_id = (select auth.uid())` が保証する。RLS は 021 の公開読み取りポリシー以降、他人の公開ログも可視にするため単独では不十分
- `max_depth_m` は numeric のため、アプリ側は `toNumber`（`@/shared/lib/number`）で数値化する

## アプリ型との対応

- 生成型 `Database['public']['Tables']['regulators']['Row']` / `Database['public']['Functions']['get_dive_stats']` を使用（手書き row 型禁止）
- camelCase 変換は `features/regulators/types.ts` の `mapRegulator` に集約
