# Data Model: dive_photos + Storage バケット

012-photo-attachments が追加する DB / Storage オブジェクト。新規テーブル `public.dive_photos`（`dives` に N:1）と、Supabase Storage の private バケット `dive-photos` + `storage.objects` の RLS ポリシー。

マイグレーション:

- `supabase/migrations/<ts>_create_dive_photos.sql`（テーブル + RLS + インデックス + トリガ）
- `supabase/migrations/<ts>_create_dive_photos_storage_policies.sql`（Storage 判定関数 + storage.objects ポリシー）

設定変更:

- `supabase/config.toml` に `[storage.buckets.dive-photos]` を追加（private / `file_size_limit` / `allowed_mime_types`）

## 参照する既存テーブル

`public.dives`（[specs/002-dive-log-crud/data-model.md](../002-dive-log-crud/data-model.md)）

| 参照カラム | 型 | 用途 |
|---|---|---|
| `id` | `uuid` | `dive_photos.dive_id` の参照先（FK） |
| `user_id` | `uuid` | 所有者。写真の所有権・Storage パス 1 階層目と一致 |
| `is_public` | `boolean` | 公開写真の anon 読取可否の判定キー（FR-006 / FR-008） |

## テーブル: public.dive_photos

ダイブログに添付した写真 1 枚のメタデータ。画像本体は Storage（`display`/`thumb`）に保存し、本テーブルはそのパスとメタのみ持つ。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | 主キー。Storage パスの `{photo_uuid}` と一致 |
| `dive_id` | `uuid` | NO | — | 添付先ログ。`dives(id)` を参照、`on delete cascade`（FR-014） |
| `user_id` | `uuid` | NO | — | 所有者。`dives.user_id` と同値（RLS・Storage パス整合・インデックス用に非正規に保持） |
| `display_path` | `text` | NO | — | 表示用 WebP の Storage オブジェクトパス（`{user_id}/{dive_id}/display/{id}.webp`） |
| `thumb_path` | `text` | NO | — | サムネイル WebP のパス（`.../thumb/{id}.webp`） |
| `caption` | `text` | NO | `''` | 任意のキャプション（FR-012）。空文字＝未設定 |
| `sort_order` | `integer` | NO | `0` | 表示順（昇順）。ログ内で連番（FR-010） |
| `is_cover` | `boolean` | NO | `false` | 代表写真フラグ（FR-011）。ログ内で高々 1 件 |
| `width` | `integer` | YES | — | 表示用画像の幅（px）。レイアウトシフト防止用 |
| `height` | `integer` | YES | — | 表示用画像の高さ（px） |
| `created_at` | `timestamptz` | NO | `now()` | 添付日時 |
| `updated_at` | `timestamptz` | NO | `now()` | 更新日時（トリガ自動更新） |

### 制約・インデックス

| 種別 | 定義 | 目的 |
|---|---|---|
| PK | `(id)` | 主キー |
| FK | `dive_photos_dive_id_fkey`: `dive_id` → `public.dives(id)` `on delete cascade` | ログ削除で写真メタも削除（FR-014）。本体は Storage 側を Action / クリーンアップで削除 |
| FK | `dive_photos_user_id_fkey`: `user_id` → `public.users(id)` `on delete cascade` | 所有者削除時の波及 |
| CHECK | `dive_photos_caption_len_check`: `char_length(caption) <= 200` | キャプション長制限（FR-012） |
| CHECK | `dive_photos_sort_order_check`: `sort_order >= 0` | 表示順の健全性 |
| INDEX | `idx_dive_photos_dive_id_sort_order`: `(dive_id, sort_order)` | ログの写真を順序付きで取得 |
| INDEX | `idx_dive_photos_user_id`: `(user_id)` | 本人の写真総量・RLS 補助（FK 用） |
| UNIQUE(partial) | `idx_dive_photos_one_cover_per_dive`: `unique (dive_id) where is_cover` | 代表写真をログ内 1 枚に限定（FR-011） |

> 枚数上限（10 枚 / ログ）は DB 集計制約を置かず Server Action 側で「既存枚数 + 追加枚数 <= 10」を検証する（FR-003）。理由: Postgres で「行数 <= N」を宣言的に強制するには重いトリガが必要で、単一ユーザー直列追加のため Action 検証で十分。

### RLS ポリシー（`public.dive_photos`）

`alter table public.dive_photos enable row level security;`（constitution IV / sql.md）

| ポリシー名 | 操作 | 条件 |
|---|---|---|
| `users can read own dive photos` | `SELECT` | `(select auth.uid()) = user_id` |
| `anyone can read public dive photos` | `SELECT` | `exists (select 1 from public.dives d where d.id = dive_id and d.is_public)` |
| `users can insert own dive photos` | `INSERT` | `with check ((select auth.uid()) = user_id and exists (select 1 from public.dives d where d.id = dive_id and d.user_id = (select auth.uid()) and d.deleted_at is null))` |
| `users can update own dive photos` | `UPDATE` | `using ((select auth.uid()) = user_id and deleted_at is null)` / `with check ((select auth.uid()) = user_id and deleted_at is null and exists (select 1 from public.dives d where d.id = dive_id and d.user_id = (select auth.uid()) and d.deleted_at is null))` |
| `users can delete own dive photos` | `DELETE` | `using ((select auth.uid()) = user_id and deleted_at is null)` |

- `auth.uid()` は `(select auth.uid())` で包む（sql.md `auth_rls_initplan`）。
- 公開 SELECT は `dives.is_public` を `exists` で参照し FR-006 / FR-008 を満たす（非公開化で即 false）。
- INSERT / UPDATE の `with check` は `dive_id` が「本人所有かつ未削除の dive」であることを検証する（`20260702110000_alter_dive_photos_write_policies.sql`。「自分の user_id + 他人の dive_id」の挿入で他人の公開ログに任意画像を表示させられる問題への対応）。
- UPDATE / DELETE は `deleted_at is null` の行に限定し、管理画面でモデレーション（論理削除）された写真を所有者が編集・物理削除できないようにする（同マイグレーション）。

### updated_at トリガ

既存の `public.handle_updated_at()`（users マイグレーションで定義済み・`set search_path = ''`）を再利用する。

```sql
create trigger dive_photos_handle_updated_at
    before update on public.dive_photos
    for each row
    execute function public.handle_updated_at();
```

## Storage: バケット `dive-photos`

`supabase/config.toml`（抜粋イメージ）:

```toml
[storage.buckets.dive-photos]
public = false
file_size_limit = "10MiB"          # 変換前の原本上限（FR-003）
allowed_mime_types = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
```

### オブジェクトパス設計

```
dive-photos/{user_id}/{dive_id}/{kind}/{photo_id}.{ext}
  kind = orig    … クライアントが上げた原本（処理後に削除。通常は残らない）
       = display … 表示用 WebP（長辺上限）
       = thumb   … サムネイル WebP（小サイズ）
```

- パス 1 階層目 = `user_id`、2 階層目 = `dive_id` を **RLS 判定のキー**として使う（`storage.foldername(name)`）。

### Storage 公開判定関数

`storage.objects` ポリシー式から呼ぶ判定ヘルパー。パスから `dive_id` を取り出し、その dive が公開中**かつ未削除**かを返す。

```sql
create or replace function public.is_public_dive_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.dives d
        where d.id = (split_part(object_name, '/', 2))::uuid
          and d.is_public
          and d.deleted_at is null
    );
$$;
```

- `security definer` + `set search_path = ''`（sql.md）。`split_part(name, '/', 2)` で 2 階層目の `dive_id` を取得。
- `d.deleted_at is null` は `20260702110200_alter_is_public_dive_photo_exclude_deleted.sql` で追加。論理削除された公開ログの写真オブジェクト（display / thumb）がパスを知る anon から取得可能なまま残る問題への対応。

### `storage.objects` RLS ポリシー（バケット `dive-photos`）

| ポリシー名 | ロール | 操作 | 条件 |
|---|---|---|---|
| `owner can manage own dive photo objects` | authenticated | ALL | `bucket_id = 'dive-photos' and (select auth.uid())::text = (storage.foldername(name))[1]` |
| `public can read display of public dives` | anon, authenticated | SELECT | `bucket_id = 'dive-photos' and (storage.foldername(name))[3] in ('display','thumb') and public.is_public_dive_photo(name)` |

- 本人は自分の `{user_id}/...` 配下を全操作可（直アップロード INSERT・処理後の書き込み・削除）。
- anon は `display`/`thumb` かつ公開 dive の写真のみ読取可。`orig` は anon から常に不可（多層防御。R3）。
- 表示は本人ページ・公開ページとも、許可された範囲でサーバーが短期署名 URL を発行して `next/image` に渡す。

## アプリ層の型（DB 由来 + 表示用）

`service-front/src/features/dives/types.ts` に追加:

```typescript
/** dive_photos の 1 行（camelCase 変換後） */
export interface DivePhoto {
    id: string;
    diveId: string;
    displayPath: string;
    thumbPath: string;
    caption: string;
    sortOrder: number;
    isCover: boolean;
    width: number | null;
    height: number | null;
}

/** 表示用（署名 URL を解決済み）。ギャラリー / サムネイルに渡す */
export interface DivePhotoView {
    id: string;
    displayUrl: string;
    thumbUrl: string;
    caption: string;
    isCover: boolean;
    width: number | null;
    height: number | null;
    /** alt 用の代替テキスト（caption 優先、無ければログ情報由来） */
    alt: string;
}
```

`packages/supabase/src/types.ts` の `Database['public']['Tables']` に `dive_photos` の Row / Insert / Update を追加（既存 `dives` と同形式）。

## エンティティ関係

```text
users ||--o{ dives : "1:N (user_id)"
dives ||--o{ dive_photos : "1:N (dive_id, on delete cascade)"
dive_photos }o--|| storage.objects : "display_path / thumb_path で対応"
```

- `dive_photos` 削除 / `dives` 削除（cascade）でメタ行は消えるが、Storage オブジェクトは自動削除されない。
  - 単一写真削除は `deleteDivePhoto` Action が Storage オブジェクトも削除する。
  - ログ削除（cascade）で孤立する Storage オブジェクトは、ログ削除 Action 側でプレフィックス `{user_id}/{dive_id}/` を一括削除する（実装時に既存 `deleteDive` を拡張）。
