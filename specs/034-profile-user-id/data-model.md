# Data Model: ユーザー ID とプロフィール URL（034 Rev.2）

マイグレーションは 1 ファイル: `supabase/migrations/<ts>_add_user_handle.sql`（1 目的 = handle の導入一式）。
Rev.1 の `20260712100000_create_get_user_id_by_nickname_fn.sql` はブランチから削除する（research.md Decision 5）。

## user_details.handle（新規カラム）

| 項目 | 内容 |
|---|---|
| 型 | `text not null` |
| 形式 CHECK | `handle ~ '^[a-z][a-z0-9_-]{2,29}$'`（小文字英字始まり・計 3〜30 文字） |
| 一意 | `create unique index user_details_handle_key on public.user_details (handle);`（小文字保存のため式不要） |
| backfill | `update ... set handle = 'user-' || substr(replace(user_id::text, '-', ''), 1, 8)`（NOT NULL 付与前に実行） |
| comment | 'プロフィール URL に使うユーザー ID（034）。小文字英数字と - _、3〜30 文字' |

適用順: ① drop function if exists get_user_id_by_nickname ② add column（nullable）③ backfill ④ set not null + CHECK ⑤ unique index ⑥ トリガー・RPC 更新。

## handle_new_user トリガー（更新）

既存定義（insert 列に `handle` を追加）。値は meta 優先・欠落時は自動採番と同じ規則:

```sql
coalesce(
    nullif(new.raw_user_meta_data->>'handle', ''),
    'user-' || substr(replace(new.id::text, '-', ''), 1, 8)
)
```

※ 関数全体を `create or replace` で再定義する（現行定義は稼働 DB の `pg_get_functiondef` から転記し、`security definer` / `set search_path = ''` を維持）。

## RPC

### get_user_id_by_handle（新規）

```sql
create or replace function public.get_user_id_by_handle(p_handle text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select user_id
    from public.user_details
    where handle = lower(trim(p_handle))
    limit 1;
$$;

revoke all on function public.get_user_id_by_handle(text) from public;
grant execute on function public.get_user_id_by_handle(text) to authenticated;
```

### is_handle_taken（新規・フォームの重複事前チェック）

```sql
create or replace function public.is_handle_taken(p_handle text, p_exclude_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.user_details
        where handle = lower(trim(p_handle))
          and (p_exclude_user_id is null or user_id <> p_exclude_user_id)
    );
$$;

revoke all on function public.is_handle_taken(text, uuid) from public;
grant execute on function public.is_handle_taken(text, uuid) to anon, authenticated;
-- anon にも grant: サインアップ（未認証）での重複チェックに使うため（is_nickname_taken と同じ扱い）
```

### get_user_public_profiles（拡張）

戻りを `returns table (user_id uuid, nickname text, handle text)` に変更（drop してから create。呼び出し側は列追加のみで互換）。

## アプリ側の定数（profile-path モジュール）

| 定数 | 値 | 用途 |
|---|---|---|
| `HANDLE_PATTERN` | `/^[a-z][a-z0-9_-]{2,29}$/` | 形式検証（schema・URL 判別で共用） |
| `RESERVED_USER_SEGMENTS` | `['search']` | 予約パス。登録拒否（FR-003） |
| uuid 判別パターン | Rev.1 と同じ | uuid URL の転送判別 |

## seed（テンプレート更新）

各テストユーザーの `raw_user_meta_data` に `handle` を追加する:

| ユーザー | handle |
|---|---|
| test@example.com | `taro` |
| buddy@example.com | `buddy-taro` |
| rename@example.com | `rename-saburo` |
| admin@example.com | `admin-ops`（`admin` は将来の予約余地を考慮して避ける） |

## 状態遷移

なし（handle は値の変更のみ。削除・無効化の状態は持たない）。
