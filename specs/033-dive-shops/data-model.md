# Data Model: ダイビングショップ登録（033-dive-shops）

マイグレーションは 2 ファイルに分ける（1 マイグレーション 1 目的）:

1. `supabase/migrations/<ts>_create_dive_shops.sql` — 新テーブル + RLS + トリガー
2. `supabase/migrations/<ts>_add_dive_shop_links.sql` — 既存 3 テーブルへの FK 追加 + 所有者ガード

## dive_shops（新規）

ユーザーが登録するダイビングショップ。本人のみアクセス可能なプライベートデータ（FR-006 / FR-015）。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | |
| `user_id` | `uuid` | not null, FK → `public.users(id)` `on delete cascade` | 登録した本人 |
| `name` | `text` | not null, `check (length(trim(name)) > 0 and char_length(name) <= 120)` | ショップ名（必須・FR-002） |
| `address` | `text` | not null, `default ''`, `check (char_length(address) <= 255)` | 住所（任意） |
| `phone` | `text` | not null, `default ''`, `check (char_length(phone) <= 20)` | 電話番号（形式検証はアプリ側 yup で実施） |
| `website_url` | `text` | not null, `default ''`, `check (char_length(website_url) <= 2048)` | Web サイト URL（URL 形式検証は yup） |
| `memo` | `text` | not null, `default ''`, `check (char_length(memo) <= 1000)` | 個人メモ |
| `latitude` | `numeric(8, 6)` | nullable, `check (latitude between -90 and 90)` | ジオコーディング結果の緯度 |
| `longitude` | `numeric(9, 6)` | nullable, `check (longitude between -180 and 180)` | 同・経度 |
| `created_at` | `timestamptz` | not null, `default now()` | |
| `updated_at` | `timestamptz` | not null, `default now()` | `handle_updated_at` トリガーで自動更新 |

- 緯度・経度は住所から導出可能な値だが、外部 API（Google Geocoding）の解決結果であり再現性がないため冗長保存する（research.md Decision 2。表示時の外部 API 依存をなくす）。住所が空・解決失敗時は両方 null（片方だけの状態は作らない）
- 同名ショップの重複は許容する（unique 制約なし。spec Assumptions）

```sql
create index idx_dive_shops_user_id on public.dive_shops(user_id);

create trigger dive_shops_handle_updated_at
    before update on public.dive_shops
    for each row
    execute function public.handle_updated_at();
```

### RLS

```sql
alter table public.dive_shops enable row level security;

create policy "users can read own dive shops"
    on public.dive_shops for select
    using ((select auth.uid()) = user_id);

create policy "users can insert own dive shops"
    on public.dive_shops for insert
    with check ((select auth.uid()) = user_id);

create policy "users can update own dive shops"
    on public.dive_shops for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "users can delete own dive shops"
    on public.dive_shops for delete
    using ((select auth.uid()) = user_id);
```

### comment

```sql
comment on table public.dive_shops is 'ユーザーが登録するダイビングショップ（本人のみ参照可のプライベートデータ）';
comment on column public.dive_shops.latitude is '住所のジオコーディング結果（Google Geocoding API）。解決失敗・住所未入力時は null';
```

## 既存テーブルへの追加（紐付け）

`dives` / `dive_plans` / `application_sheets` に同じ形の列を追加する（FR-007〜010）。

| テーブル | 追加カラム | 制約 | 意味 |
|---|---|---|---|
| `dives` | `dive_shop_id uuid` | nullable, FK → `public.dive_shops(id)` `on delete set null` | このログで利用したショップ |
| `dive_plans` | `dive_shop_id uuid` | 同上 | この予定で利用するショップ |
| `application_sheets` | `dive_shop_id uuid` | 同上 | 保存シートの宛先ショップ（シートごと・research.md Decision 4） |

```sql
create index idx_dives_dive_shop_id on public.dives(dive_shop_id);
create index idx_dive_plans_dive_shop_id on public.dive_plans(dive_shop_id);
create index idx_application_sheets_dive_shop_id on public.application_sheets(dive_shop_id);
```

- `on delete set null` により、ショップ削除時は紐付けだけが外れて予定・ログ・シート保存内容は残る（FR-010 / SC-005）

### 所有者ガード（トリガー）

FK 制約だけでは他人のショップ id を設定できてしまうため、`dive_shop_id` を設定する insert / update 時に本人所有を検証する（research.md Decision 3）。

```sql
create or replace function public.ensure_dive_shop_owned()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.dive_shop_id is not null and not exists (
        select 1
        from public.dive_shops s
        where s.id = new.dive_shop_id
          and s.user_id = new.user_id
    ) then
        raise exception 'dive_shop_id % is not owned by user %', new.dive_shop_id, new.user_id;
    end if;
    return new;
end;
$$;

create trigger dives_ensure_dive_shop_owned
    before insert or update of dive_shop_id on public.dives
    for each row
    execute function public.ensure_dive_shop_owned();

-- dive_plans / application_sheets にも同名トリガーを作成する
```

## リレーション図

```text
users 1 ─── N dive_shops
                 │ 0..1（on delete set null）
   dives N ──────┤
   dive_plans N ─┤
   application_sheets N ─┘（シートごとの宛先ショップ）
```

## 状態遷移

なし（ショップにライフサイクル状態は持たない。削除 = 物理削除 + FK の set null）。
