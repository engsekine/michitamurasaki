# Data Model: 運営管理画面（admin-front）

本機能で追加・変更するスキーマ。既存の利用者データ（`users` / `user_details` / `dives` / `dive_sites` / `dive_photos` / `certifications` 等）は変更せず、**管理者識別・監査・ソフトデリート・admin RLS** を上乗せする。すべて `supabase/migrations/` のマイグレーション SQL で適用する（本番直接 DDL 禁止 / Constitution IV）。

命名・型・RLS は `.claude/rules/sql.md` に準拠（snake_case / `uuid` 主キー / `timestamptz` / 関数 `set search_path = ''` / `auth` 関数はサブクエリ包み）。

## 新規エンティティ

### admin_users（管理者）

管理者を利用者プロフィールと分離して識別する専用テーブル。`auth.users` を共有し、ここに行があるユーザーのみ管理者とみなす（R1）。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | `uuid` | PK, `references auth.users(id) on delete cascade` | 管理者の認証ユーザー ID |
| `display_name` | `text` | `not null check (length(trim(display_name)) > 0)` | 管理画面上の表示名 |
| `role` | `text` | `not null default 'admin' check (role in ('admin','superadmin'))` | 権限種別。`superadmin` のみ他管理者を管理可 |
| `created_at` | `timestamptz` | `not null default now()` | |
| `updated_at` | `timestamptz` | `not null default now()`（トリガ自動更新） | |
| `deleted_at` | `timestamptz` | nullable | 無効化（ソフトデリート）日時 |

- 初期管理者は `seed.sql` または手動マイグレーションで投入（公開導線からの自己登録不可）。
- FR-015（自分・他管理者の誤削除防止）: アプリ層で「最後の superadmin / 自分自身の無効化」をブロック。`role` 変更・無効化は `superadmin` のみ。
- `updated_at` は既存 `public.handle_updated_at()` トリガを再利用。

### admin_audit_logs（操作ログ）

管理画面で行われた全データ変更の監査記録（US5 / FR-018）。追記専用（更新・削除不可）。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | `uuid` | PK `default gen_random_uuid()` | |
| `actor_id` | `uuid` | `not null references public.admin_users(id) on delete restrict` | 実行した管理者 |
| `action` | `text` | `not null check (action in ('create','update','soft_delete','hard_delete','restore'))` | 操作種別 |
| `target_table` | `text` | `not null check (char_length(target_table) <= 63)` | 対象テーブル名 |
| `target_id` | `text` | `not null` | 対象レコードの主キー（複合 PK も文字列化で許容） |
| `changes` | `jsonb` | nullable | 変更差分（before/after の要約）。個人情報は最小限に |
| `created_at` | `timestamptz` | `not null default now()` | 操作日時 |

- インデックス: `idx_admin_audit_logs_created_at (created_at desc)`, `idx_admin_audit_logs_target (target_table, target_id)`, `idx_admin_audit_logs_actor_id (actor_id)`。
- `on delete restrict`: 監査対象である管理者は監査ログがある限り物理削除させない（ソフトデリートで無効化する）。

## 既存テーブルへの変更

### soft-delete 列の追加（R4）

管理対象テーブルに `deleted_at timestamptz`（nullable）を追加する。対象（MVP）:

- `public.dives`
- `public.dive_sites`
- `public.dive_photos`
- 汎用エディタで削除を許可するマスタ（`certifications` 等）は段階的に追加

部分インデックス例: `create index idx_dives_active on public.dives (user_id) where deleted_at is null;`

> `users` / `user_details` の「削除」は原則アカウント無効化として扱い、物理削除は本 MVP の対象外（auth スキーマ管理は spec 範囲外）。

### クロスアプリ影響（service-front）

`deleted_at` 追加に伴い、**service-front の利用者向け取得は削除済みを除外**する。いずれかで担保（tasks で確定）:

1. 既存「本人のみ」select ポリシーの `using` に `and deleted_at is null` を追加、または
2. service-front の queries / hooks のクエリビルダーに `.is('deleted_at', null)` を付与（`lib/` のクエリビルダー共有箇所を一括修正）。

回帰テスト（Vitest / Playwright）で「ソフトデリート済みレコードが利用者側に出ない」ことを検証する。

### 削除済みレコードに対する所有者（利用者）の権限

所有者は削除済み行を参照・編集・削除できない（20260702110100 / 20260702110000 で UPDATE/DELETE ポリシーに `deleted_at is null` を追加済み）。復元は管理者ポリシー経由のみ。

## RLS ポリシー（R2）

### 判定関数

```sql
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.admin_users a
    where a.id = (select auth.uid()) and a.deleted_at is null
  );
$$;

-- 有効な上位管理者か（管理者の追加・無効化の許可判定 / FR-015）
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.admin_users a
    where a.id = (select auth.uid()) and a.role = 'superadmin' and a.deleted_at is null
  );
$$;
```

### 管理対象テーブルの admin ポリシー

各管理対象テーブルに既存ポリシーを**残したまま**追加する（OR 評価）。例（`dives`）:

```sql
create policy "admins manage all dives"
  on public.dives for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
```

- 同型のポリシーを `dive_sites` / `dive_photos` / `users` / `user_details` / `certifications` 等、管理対象全テーブルに追加。
- `dive_sites` は現状「authenticated は select のみ（書き込みポリシーなし）」なので、admin の `for all` 追加で初めて管理画面からの書き込みが可能になる（既存マイグレーションのコメント通り）。

### admin_users / admin_audit_logs の RLS

```sql
alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;

-- 管理者は管理者一覧を参照可
create policy "admins read admin users"
  on public.admin_users for select
  to authenticated
  using ((select public.is_admin()));

-- 管理者の追加・更新・無効化は superadmin のみ（アプリ層でも二重チェック）
-- is_superadmin() は security definer のため admin_users 自身のポリシーから呼んでも再帰しない
create policy "superadmins manage admin users"
  on public.admin_users for all
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

-- 監査ログは管理者が参照・追記のみ可（更新・削除ポリシーなし = deny）
create policy "admins read audit logs"
  on public.admin_audit_logs for select
  to authenticated
  using ((select public.is_admin()));

create policy "admins insert audit logs"
  on public.admin_audit_logs for insert
  to authenticated
  with check ((select public.is_admin()) and actor_id = (select auth.uid()));
```

## マイグレーション順序

1. `20260620100000_create_admin_users.sql` — `admin_users` + `updated_at` トリガ + 部分インデックス `idx_admin_users_active` + RLS 有効化（ポリシーは次ファイル）
2. `20260620100100_create_admin_auth_functions.sql` — `public.is_admin()` / `public.is_superadmin()` + `admin_users` の RLS ポリシー（admin_users を参照するポリシーを同テーブルに直書きすると RLS 評価が無限再帰するため、security definer 関数を先に定義し、ポリシーは関数経由にしてこのファイルにまとめる）
3. `20260620100200_create_admin_audit_logs.sql` — `admin_audit_logs` + RLS（select / insert のみ）+ インデックス
4. `20260620100300_add_soft_delete_columns.sql` — 管理対象テーブル（`dives` / `dive_sites` / `dive_photos`）へ `deleted_at` + 部分インデックス
5. `20260620100400_add_admin_rls_policies.sql` — 各管理対象テーブルへ admin ポリシー追加
6. `20260620100500_filter_soft_deleted_from_user_reads.sql` — service-front の利用者向け read ポリシーに `deleted_at is null` を反映（管理者ポリシーは復元のため除外しない）
7. `20260620100600_prevent_last_superadmin_removal.sql` — 最後の superadmin の無効化・降格を防ぐ DB トリガ（FR-015 の DB 層防御）
8. `20260702110500_add_admin_users_prevent_last_superadmin_delete.sql` — DELETE 経路の保護（最後の superadmin の物理削除を同トリガ群でブロック）

> 1 マイグレーション 1 目的（sql.md）。ただし RLS 再帰回避のため、判定関数と `admin_users` ポリシーは #2 に同居させる（FK / 依存が強い関数・ポリシーは同一ファイルにまとめてよい）。

## エンティティ関連図（概念）

```text
auth.users 1───1 public.users 1───1 user_details
   │  └─────────1 admin_users (管理者のみ)
   │
admin_users 1───* admin_audit_logs (actor_id)
   │
public.dives *───1 users / *───? dive_sites / 1───* dive_photos
   （管理対象テーブルは deleted_at を持ち、is_admin() ポリシーで管理者が全行操作可能）
```
