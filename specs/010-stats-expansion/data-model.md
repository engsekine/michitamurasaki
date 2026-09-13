# Data Model: get_dive_yearly_counts() / get_dive_monthly_stats()

010-stats-expansion が追加する DB オブジェクト。**新規テーブル・カラム追加はなし**（既存 `dives` の `dive_date` / `water_temp_c` / `max_depth_m` から導出する集計のみ）。

マイグレーション:

- `supabase/migrations/<ts>_create_get_dive_yearly_counts.sql`
- `supabase/migrations/<ts>_create_get_dive_monthly_stats.sql`

## 参照する既存テーブル

`public.dives`（[specs/002-dive-log-crud/data-model.md](../002-dive-log-crud/data-model.md)）

| 参照カラム | 型 | 備考 |
|---|---|---|
| `dive_date` | `date` | NOT NULL。集計の時間軸 |
| `water_temp_c` | `numeric(4,1)` | nullable。null は水温集計から除外（FR-006） |
| `max_depth_m` | `numeric(5,2)` | NOT NULL |
| `user_id` | `uuid` | RLS（`(select auth.uid()) = user_id`）で本人行のみに絞られる |

## RPC: public.get_dive_yearly_counts()

年別のダイビング本数。**記録のある年のみ**返す（歯抜け年の 0 埋めはアプリ層 `lib/trends.ts` — research.md R-003）。

```sql
create or replace function public.get_dive_yearly_counts()
returns table (
    year integer,
    dive_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        extract(year from dive_date)::integer,
        count(*)
    from public.dives
    where user_id = (select auth.uid())
    group by 1
    order by 1;
$$;
```

| 列 | 型 | 説明 |
|---|---|---|
| `year` | `integer` | 西暦年（例: 2026） |
| `dive_count` | `bigint` | その年の本数（>= 1。0 の年は行が存在しない） |

## RPC: public.get_dive_monthly_stats(months_back integer default 12)

月別のダイビング本数。基準月（現在月）から遡って `months_back` ヶ月分のうち、**記録のある月のみ**返す。

> **変更（feat/design-change・2026-07-10）**: 平均水温・月内最大深度（コンディション記録系）の集計を廃止し、月別の本数のみを返す構成に変更した（マイグレーション `20260710090000_alter_get_dive_monthly_stats_count_only.sql`。戻り値型の変更のため drop → create）。統計の推移は「年別本数 / 月別本数」の 2 枚構成。

```sql
create function public.get_dive_monthly_stats(months_back integer default 12)
returns table (
    month text,        -- 'YYYY-MM'
    dive_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        to_char(dive_date, 'YYYY-MM'),
        count(*)
    from public.dives
    where user_id = (select auth.uid())
      and dive_date >= date_trunc('month', current_date) - make_interval(months => greatest(months_back, 1) - 1)
    group by 1
    order by 1;
$$;
```

| 列 | 型 | 説明 |
|---|---|---|
| `month` | `text` | `YYYY-MM` 形式の年月 |
| `dive_count` | `bigint` | その月の本数 |

### 設計メモ

- `months_back` の既定 12 は spec Assumptions（直近 12 ヶ月）に対応。呼び出し側は固定値 12 のみ渡し、SQL 側でも `greatest(months_back, 1)` で 1 未満を防御する
- 記録のある月のみ返す（0 件月の補完・空状態判定はアプリ層 — research.md R-006）
- 2 RPC とも `security invoker` + 既存 RLS ポリシー（`dives` の select ポリシー）で本人行のみ集計（FR-008）。`where user_id = (select auth.uid())` は RLS と二重の防御 + インデックス（`idx_dives_user_id_dive_date`）利用のため明示する
- `set search_path = ''` + 全オブジェクトのスキーマ修飾（`.claude/rules/sql.md` 準拠）

## アプリ層の導出モデル（DB 保存なし）

`service-front/src/features/dashboard/types.ts` に追加。0 埋め後の表示用モデル。

```typescript
/** 年別本数（get_dive_yearly_counts + 歯抜け年 0 埋め後） */
export interface YearlyDiveCount {
    year: number;
    diveCount: number;
}

/** 月別統計（get_dive_monthly_stats + 直近 12 ヶ月 0 埋め後） */
export interface MonthlyDiveStat {
    /** 'YYYY-MM' */
    month: string;
    diveCount: number;
}
```

`packages/supabase/src/types.ts` の `Functions` に両 RPC の Args / Returns 型を追加する（既存 `get_dive_stats` と同形式）。
