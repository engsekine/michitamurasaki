# Data Model: ダイビング申し込みシートのテキスト出力

**Date**: 2026-07-11（複数シート対応で改訂） | **Feature**: [spec.md](./spec.md) | **Design**: [research.md](./research.md) Decision 2

## 新規テーブル: `public.application_sheets`（この PR で新設するのはこの 1 つ）

フォーム全体のスナップショットを保持する。`kind` で 2 用途を持つ:
- `kind = 'sheet'`: 名前付きの保存シート（1 ユーザー N 件・上限 20 件はアプリ側で制御・一覧表示。FR-010）
- `kind = 'base'`: 「基本情報を保存」で upsert される基本情報 + 経験の既定値（1 ユーザー 1 件・部分ユニーク制約・一覧非表示。FR-014）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | |
| `user_id` | `uuid` | `not null`, `references public.users(id) on delete cascade` | 本人に帰属 |
| `kind` | `text` | `not null default 'sheet'`, `check in ('sheet', 'base')` | sheet = 保存シート / base = 基本情報 |
| `name` | `text` | `not null`, `trim 後 1 文字以上`, `char_length <= 50` | シート名（kind=base は固定名「基本情報」） |
| `full_name` | `text` | `not null default ''`, `<= 60` | お名前（自動入力の上書き値を含むスナップショット） |
| `age` | `integer` | nullable, `0..999` | 年齢 |
| `birth_on` | `date` | nullable | 生年月日 |
| `gender` | `text` | nullable, `check in ('male', 'female')` | 性別（未選択は null） |
| `phone` | `text` | `not null default ''`, `<= 20` | 携帯電話番号 |
| `emergency_contact_relation` | `text` | `not null default ''`, `<= 40` | 緊急連絡先の続柄 |
| `emergency_contact_phone` | `text` | `not null default ''`, `<= 20` | 緊急連絡先の電話番号 |
| `nearest_station` | `text` | `not null default ''`, `<= 100` | 最寄りの駅 |
| `license_rank` | `text` | `not null default ''`, `<= 60` | ライセンスランク |
| `dive_count` | `integer` | nullable, `>= 0` | 経験本数 |
| `last_dive_year_month` | `text` | nullable, `~ '^\d{4}-\d{2}$'` | 最終ダイブ年月（YYYY-MM。フォームでは「2026年7月」表記） |
| `has_dry_suit_experience` | `boolean` | nullable | ドライスーツ経験 |
| `dry_suit_dive_count` | `integer` | nullable, `>= 0` | ドライスーツの経験本数（約） |
| `has_rental` | `boolean` | nullable | レンタル器材の有無 |
| `rental_items` | `jsonb` | `not null default '[]'` | 選択したレンタル品目キーの配列 |
| `omit_rental_block` | `boolean` | `not null default false` | 未該当ブロックの省略トグル（FR-012） |
| `height_cm` | `numeric(4, 1)` | nullable, `> 0 and <= 300` | 身長 |
| `weight_kg` | `numeric(4, 1)` | nullable, `> 0 and <= 500` | 体重 |
| `foot_size_cm` | `numeric(4, 1)` | nullable, `> 0 and <= 50` | 足のサイズ |
| `has_contact_lens` | `boolean` | nullable | コンタクトレンズの有無 |
| `contact_lens_type` | `text` | nullable, `check in ('hard', 'soft', 'disposable')` | コンタクトの種類 |
| `needs_prescription_mask` | `boolean` | nullable | 度付きマスクレンタルの要否 |
| `created_at` | `timestamptz` | `not null default now()` | |
| `updated_at` | `timestamptz` | `not null default now()`（トリガで自動更新） | |

### 設計メモ

- **フォーム全体をスナップショット保存**: シートは「ショップごとの申込内容」の単位。氏名等は `user_details` にもあるが、シートは上書き値を含む自己完結のスナップショットとして冗長保持する（clarify 2026-07-11。正規化の例外はスナップショット用途のため）
- **`rental_items` は jsonb**: 個別に検索せず常にシート単位でまとめて扱うため、子テーブルではなく jsonb 配列で保持する（SQL 規約 1NF の例外条項）。妥当なキーかどうかはアプリ側（yup + `sheetToFormValues`）で検証する
- **boolean は nullable**: 「未入力（空欄で出力）」と「無」を区別するため
- **`updated_at` トリガ**: 既存の `public.handle_updated_at()` を再利用する
- **インデックス**: `idx_application_sheets_user_id_updated_at (user_id, updated_at desc)` — 一覧（本人分・更新順）用
- **部分ユニーク制約**: `application_sheets_user_id_base_key (user_id) where kind = 'base'` — 基本情報は 1 ユーザー 1 件
- **基本情報のプリフィル**: 新規シート作成時、kind='base' の値を user_details / certifications / dives 由来の値より優先し、空欄はそれらで補完する

## RLS ポリシー

```sql
alter table public.application_sheets enable row level security;

create policy "users can read own application sheets"
    on public.application_sheets for select
    using ((select auth.uid()) = user_id);

create policy "users can insert own application sheets"
    on public.application_sheets for insert
    with check ((select auth.uid()) = user_id);

create policy "users can update own application sheets"
    on public.application_sheets for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "users can delete own application sheets"
    on public.application_sheets for delete
    using ((select auth.uid()) = user_id);
```

- delete ポリシーあり（一覧からの削除 UI に対応）。アカウント削除時は FK cascade で消える

## マイグレーション

- `20260711140000_create_application_sheets.sql` — application_sheets を新設（この PR の新規テーブルはこの 1 つ。PR 内で作成していた application_profiles / application_base_profiles 等のマイグレーションは未リリースのため 1 本に squash 済み）

## 参照する既存テーブル（変更なし）

| テーブル | 参照カラム | 用途 |
|---|---|---|
| `user_details` | `last_name`, `first_name`, `birth_on`, `gender`, `height_cm`, `weight_kg` | 新規シートの自動入力（FR-007） |
| `certifications` | `rank`（取得日降順の先頭） | ライセンスランクの自動入力 |
| `dives` | `count(*)`, `max(dive_date)` | 経験本数・最終ダイブ年月の自動入力 |
