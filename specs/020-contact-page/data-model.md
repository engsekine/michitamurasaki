# Data Model: お問い合わせページ

対象マイグレーション: `supabase/migrations/20260629110000_create_inquiries.sql`（テーブル + RLS + `submit_inquiry` 関数 + 管理者ポリシー。1 目的 1 ファイルの例外として強い依存があるため同一ファイルにまとめる / sql.md）

## テーブル: `public.inquiries`

ユーザー（ログイン有無を問わない）が送信した 1 件のお問い合わせ。運営者が閲覧・物理削除する取引系テーブル。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | 主キー |
| `name` | `text` | not null, `char_length(name) between 1 and 100` | 送信者氏名 |
| `email` | `text` | not null, `char_length(email) between 3 and 254` | 返信先メールアドレス（形式検証はアプリ層 yup + 関数で最小チェック） |
| `category` | `text` | not null, `check (category in ('question','bug','request','other'))` | 問い合わせ種別（R-004） |
| `body` | `text` | not null, `char_length(body) between 1 and 1000` | 本文（FR-005: 1–1,000 文字） |
| `submitter_user_id` | `uuid` | nullable, `references auth.users(id) on delete set null` | ログイン中に送信された場合の送信者。未ログインは null |
| `submitter_ip` | `inet` | nullable | レート制限・不正調査用の送信元 IP（管理者のみ参照 / R-002） |
| `created_at` | `timestamptz` | not null, default `now()` | 受付日時（一覧の既定ソートキー） |

- `updated_at` は持たない（問い合わせは受付後に内容を更新しない取引データ。返信・ステータス管理は範囲外）。
- `deleted_at` は持たない（保持方針は「無期限保持 + 手動の物理削除」/ clarifications）。

### インデックス

```sql
create index idx_inquiries_created_at on public.inquiries (created_at desc);   -- 一覧の既定ソート
create index idx_inquiries_ip_created_at on public.inquiries (submitter_ip, created_at desc);  -- レート制限カウント
```

### コメント

```sql
comment on table public.inquiries is 'お問い合わせフォームから送信された 1 件の問い合わせ。運営者のみ閲覧・削除可能';
comment on column public.inquiries.submitter_ip is 'レート制限・不正調査用の送信元 IP。管理者のみ参照可';
comment on column public.inquiries.category is '問い合わせ種別: question/bug/request/other';
```

## 関数: `public.submit_inquiry`

公開フォームからの唯一の書き込み経路（R-001）。`security definer` + `set search_path = ''`。anon/authenticated に EXECUTE 付与。

**シグネチャ（案）**

```text
submit_inquiry(
  p_name text,
  p_email text,
  p_category text,
  p_body text,
  p_submitter_user_id uuid,   -- ログイン時のみ。null 可
  p_submitter_ip inet         -- null 可
) returns uuid                -- 作成された inquiries.id
language plpgsql
security definer
set search_path = ''
```

**振る舞い（FR-003〜FR-007・FR-014 / R-002）**

1. 入力検証（防御的二重化）: `p_category` が許可 4 値か、`p_body` が 1–1,000 文字か、`p_name`/`p_email` が長さ範囲内かを確認し、外れたら `raise exception`（アプリ層 yup が一次防御、関数が最終防御）。
2. レート制限: `p_submitter_ip is not null` のとき、直近 60 秒の同一 IP からの件数が 3 以上なら `raise exception 'rate_limited'`。
3. 重複拒否: 直近 5 分以内に同一 IP かつ同一 `body` の行があれば `raise exception 'duplicate'`。
4. INSERT して新 `id` を返す。

> しきい値（3 件 / 60 秒・5 分）は `service-front/src/features/contact/constants.ts` と関数定義で同値管理する。

## 関数: `public.discard_recent_inquiry`

通知メール送信失敗時に保存済み行を取り消す（厳密通知 / FR-023 / R-009）。`security definer` + `set search_path = ''`。anon/authenticated に EXECUTE 付与。マイグレーション: `supabase/migrations/20260629120000_add_discard_recent_inquiry.sql`。

```text
discard_recent_inquiry(p_id uuid) returns void
language plpgsql
security definer
set search_path = ''
```

- `inquiries` から `id = p_id` かつ `created_at > now() - interval '2 minutes'` の行のみ削除する。
- 直近 2 分・当該 id 限定のため第三者による任意行削除を防ぐ（id は `submit_inquiry` の戻り値として送信者にのみ返る）。

## RLS ポリシー

```sql
alter table public.inquiries enable row level security;

-- 管理者のみ閲覧（FR-010 / FR-012）
create policy "admins read inquiries"
    on public.inquiries for select
    to authenticated
    using ((select public.is_admin()));

-- 管理者のみ物理削除（FR-018）
create policy "admins delete inquiries"
    on public.inquiries for delete
    to authenticated
    using ((select public.is_admin()));

-- INSERT ポリシーは作らない（書き込みは submit_inquiry = security definer 経由のみ / R-001）
-- UPDATE ポリシーも作らない（問い合わせは更新しない）
```

- `is_admin()` は spec 015 で定義済み（`security definer` + stable）。`(select ...)` で包み initplan 最適化（sql.md: auth_rls_initplan）。

## エンティティ関連

- `inquiries.submitter_user_id` → `auth.users.id`（任意・`on delete set null`）。ユーザー削除時も問い合わせ記録は残す。
- 種別（category）はマスタテーブルを設けず固定 4 値の `CHECK`（R-004 / sql.md: enum 回避）。

## アプリ層スキーマ（yup / `contact.schema.ts`）

| フィールド | ルール |
|---|---|
| `name` | required, max 100 |
| `email` | required, email 形式, max 254 |
| `category` | required, oneOf(['question','bug','request','other']) |
| `body` | required, max 1000（空文字は `required` で弾く。下限 1 文字は DB の `char_length(body) between 1 and 1000` が担保） |
| `website`（ハニーポット） | 任意。値があれば bot 判定（送信は受付表示のみ・保存しない / R-003） |

DB の CHECK 制約とアプリの `.max` 等は同値（length checks の二重化方針 / `add_dives_text_length_checks.sql` に倣う）。
