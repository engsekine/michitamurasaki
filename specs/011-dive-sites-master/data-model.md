# Data Model: ダイブサイト（ポイント）マスタ

## 概要

共有マスタ `public.dive_sites` を新設し、既存 `public.dives` に任意参照 `dive_site_id` を追加する。サイト名はログに冗長保存せず、表示名はマスタから解決する（[research.md R1](research.md)）。サイト別実績は導出値で保存しない。

## 1. 新規テーブル: `public.dive_sites`（共有マスタ）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|----|------|-----------|------|
| `id` | `uuid` | NO | `gen_random_uuid()` | 主キー |
| `name` | `text` | NO | — | ポイント名。**一意**（FR-001a） |
| `area` | `text` | YES | — | エリア / 地域（例: 伊豆）。表示で名称と組み合わせる |
| `country` | `text` | NO | `'JP'` | 国コード（初期は国内中心）。`check (char_length(country) <= 2)` |
| `description` | `text` | YES | — | 任意の説明 |
| `created_at` | `timestamptz` | NO | `now()` | 作成日時 |
| `updated_at` | `timestamptz` | NO | `now()` | 更新日時（トリガ自動更新） |

### 制約・インデックス

| 種別 | 定義 |
|------|------|
| 主キー | `dive_sites_pkey (id)` |
| 一意制約 | `dive_sites_name_key (name)` — 同名サイトの重複登録を防ぐ（FR-001a） |
| CHECK | `dive_sites_name_check`: `length(trim(name)) > 0` / `dive_sites_name_len_check`: `char_length(name) <= 100` |
| CHECK | `dive_sites_area_len_check`: `area is null or char_length(area) <= 60` |
| トリガ | `dive_sites_handle_updated_at`（既存 `public.handle_updated_at()` を `before update` で再利用） |

### RLS（[research.md R6](research.md)）

- `alter table public.dive_sites enable row level security;`
- **SELECT**: 認証済みユーザーに許可（全員が参照・選択できる共有マスタ）

  ```sql
  create policy "authenticated can read dive sites"
      on public.dive_sites for select
      to authenticated
      using (true);
  ```

- **INSERT / UPDATE / DELETE**: ポリシーを設けない（= デフォルト deny）。書き込みは `seed.sql` / service role のみ。管理 UI による書き込みは別機能「管理画面」+ 管理者ロールで追加する。

### 初期データ

`supabase/seed.sql` に国内主要ポイントを投入（例: 伊豆 / 大瀬崎、伊豆 / 富戸、沖縄 / 慶良間 など）。`on conflict (name) do nothing` で冪等に。

## 2. 既存テーブル改修: `public.dives`

### 追加・変更

| 変更 | 内容 |
|------|------|
| 追加カラム | `dive_site_id uuid` NULL 可。`references public.dive_sites(id) on delete restrict`（FR-009 の安全網: 参照中サイトの削除を DB で拒否） |
| 変更 | `location` を **nullable 化**（`drop not null`）。サイト参照時は null（[research.md R1](research.md)） |
| 既存 CHECK 置換 | `dives_location_check`（`length(trim(location)) > 0`）を削除し、排他 CHECK に置き換え |
| 追加 CHECK | `dives_site_or_location_check`: サイト参照と自由入力の排他・片方必須 |
| 追加インデックス | `idx_dives_user_id_dive_site_id (user_id, dive_site_id)` — 本人のサイト別実績集計用（FK インデックスも兼ねる） |

排他 CHECK の定義:

```sql
alter table public.dives
    add constraint dives_site_or_location_check check (
        (dive_site_id is not null and location is null)
        or (dive_site_id is null and location is not null and length(trim(location)) > 0)
    );
```

> 既存行は `location` 設定済み・`dive_site_id` null のため CHECK を満たす（無停止で互換 — [research.md R7](research.md)）。

### RLS

`dives` の既存 RLS（本人のみ select/insert/update/delete）をそのまま使用。`dive_site_id` の追加で変更なし。

## 3. 導出値（保存しない）

| 導出値 | 定義 | 実装 |
|--------|------|------|
| 潜水本数 | 本人の当該サイトのログ件数 | `features/dive-sites/lib/siteStats.ts` |
| 平均透明度 | 本人の当該サイトのログのうち `visibility_m` が非 null の平均（小数 1 桁。該当 0 件は表示なし） | 同上 |
| ベストシーズン | 月（1–12）別の本数集計 → 本数の多い月の上位 **3 ヶ月**（同数は月昇順）。対象ログ **3 本未満** は「傾向を出すにはログ不足」 | 同上 |
| サイト表示名 | `dive_site_id` があれば `dive_sites.name`(+`area`)、無ければ `location` | `features/dive-sites/lib/siteLabel.ts` |
| ポイント名検索一致 | `dive_sites.name` または `location` のいずれかにキーワード一致（FR-013。名前が一致するサイト ID を先に引き、`location.ilike` OR `dive_site_id.in` で合流＝2 段階クエリ） | `features/dives/lib/list-query.ts` |

## 4. マイグレーションファイル

| ファイル | 内容 |
|---------|------|
| `supabase/migrations/<ts>_create_dive_sites.sql` | `dive_sites` テーブル + 制約 + 一意 + RLS(SELECT) + `handle_updated_at` トリガ |
| `supabase/migrations/<ts>_add_dives_dive_site_id.sql` | `dives` に `dive_site_id` 追加 / `location` nullable 化 / `dives_location_check` 置換（排他 CHECK）/ インデックス |
| `supabase/seed.sql.template` | 初期ダイブサイト投入（`on conflict (name) do nothing`）。`seed.sql` は envsubst 生成物（gitignore）のため生成元を編集する |

型再生成（`supabase gen types`）で `@repo/supabase` の `Database` 型に `dive_sites` と `dives.dive_site_id` を反映する。

## 5. エンティティ関係

```text
dive_sites (1) ──< (N) dives        [dives.dive_site_id → dive_sites.id, nullable, on delete restrict]
users      (1) ──< (N) dives        [既存]
```

- 1 ログは最大 1 サイトに紐づく（サイト未参照＝自由入力のみ、も許容）。
- サイト別実績は `dives` を `user_id`（本人）+ `dive_site_id` で絞って算出する。
