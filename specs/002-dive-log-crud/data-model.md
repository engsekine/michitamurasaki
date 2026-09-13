# Data Model: `public.dives`

## メタ情報

| 項目 | 内容 |
|------|------|
| スキーマ | `public` |
| テーブル名 | `dives` |
| 説明 | ダイビングログ。PADI ログブックの標準項目を踏襲 |
| 主キー | `id` |
| RLS | 有効 |
| 関連機能 | [002 ダイブログ CRUD](spec.md) |
| ステータス | 確定 |

## 1. 概要

ユーザーが記録するダイビング 1 本ごとのログを保持するテーブル。1 ユーザーが多数のログを持つ 1:N 関係。PADI ログブックの項目を踏襲しており、必須項目（日付・場所・最大水深・潜水時間）以外は任意。

Phase 2 で「公開機能」を実装する予定があり、`is_public` / `public_slug` を先行で定義済み（Phase 1 では使用しない）。

## 2. カラム定義

### 基本情報

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|----|------|----------|------|
| `id` | `uuid` | NO | `gen_random_uuid()` | 主キー |
| `user_id` | `uuid` | NO | — | 所有ユーザー。`users(id)` を参照 |
| `dive_number` | `integer` | YES | — | 通算ダイブ番号（任意管理） |
| `dive_date` | `date` | NO | — | 潜水日。1900-01-01〜当日 |
| `entry_time` | `time` | YES | — | エントリー時刻 |
| `exit_time` | `time` | YES | — | エキジット時刻 |

### ロケーション

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|----|------|----------|------|
| `dive_site_id` | `uuid` | YES | — | ダイブサイト（マスタ）への参照（任意）。設定時は `location` を null とし表示名はマスタから取得（`20260616100100`、specs/011 参照） |
| `location` | `text` | YES | — | 自由入力のポイント名。120 文字以内。`dive_site_id` と排他でどちらか一方が必須（`dives_site_or_location_check`） |
| `dive_type` | `text` | YES | — | ボート / ビーチ / ドリフト など。40 文字以内 |

### コンディション

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|----|------|----------|------|
| `weather` | `text` | YES | — | 天気。60 文字以内 |
| `air_temp_c` | `numeric(4, 1)` | YES | — | 気温（℃） |
| `water_temp_c` | `numeric(4, 1)` | YES | — | 水温（℃） |
| `visibility_m` | `numeric(4, 1)` | YES | — | 透明度（m） |
| `wave` | `text` | YES | — | 波・うねり。60 文字以内 |
| `current_condition` | `text` | YES | — | 流れの状況。予約語 `current` を避けて `current_condition`。60 文字以内 |

### 潜水データ

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|----|------|----------|------|
| `max_depth_m` | `numeric(5, 2)` | NO | — | 最大水深（m）。0 < x ≦ 300 |
| `avg_depth_m` | `numeric(5, 2)` | YES | — | 平均水深（m） |
| `bottom_time_min` | `integer` | NO | — | 潜水時間（分）。≧ 1 |

### 装備・ガス

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|----|------|----------|------|
| `tank_type` | `text` | YES | — | `aluminum`（アルミ） / `steel`（スチール）。CHECK 制約で限定 |
| `tank_volume_l` | `numeric(4, 1)` | YES | — | タンク容量（L） |
| `gas_type` | `text` | YES | — | Air / Nitrox など。40 文字以内 |
| `o2_percent` | `numeric(4, 1)` | YES | — | 酸素濃度（%、Nitrox 用） |
| `pressure_start_bar` | `integer` | YES | — | 開始残圧（bar） |
| `pressure_end_bar` | `integer` | YES | — | 終了残圧（bar） |
| `weight_kg` | `numeric(4, 1)` | YES | — | ウェイト（kg） |
| `suit_type` | `text` | YES | — | 任意フリーテキスト（例: `ウェット 5mm` / `ドライ`）。アプリは 40 文字以内で受理 |
| `equipment_notes` | `text` | YES | — | 装備メモ。1000 文字以内 |

### メンバー・メモ

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|----|------|----------|------|
| `buddy_name` | `text` | YES | — | バディ名。100 文字以内 |
| `instructor_name` | `text` | YES | — | インストラクター名。100 文字以内 |
| `certification_dive` | `boolean` | NO | `false` | 講習ダイブか |
| `notes` | `text` | YES | — | メモ・印象。2000 文字以内 |

### 公開（Phase 2 用）

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|----|------|----------|------|
| `is_public` | `boolean` | NO | `false` | 公開フラグ |
| `public_slug` | `text` | YES | — | 公開 URL 用 slug（unique） |

### タイムスタンプ

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|----|------|----------|------|
| `created_at` | `timestamptz` | NO | `now()` | 作成日時 |
| `updated_at` | `timestamptz` | NO | `now()` | 更新日時（トリガで自動更新） |
| `deleted_at` | `timestamptz` | YES | — | 論理削除日時。null の行のみ有効（管理画面のソフトデリートで設定。`20260620100300`、specs/015 参照） |

## 3. 制約

### 主キー

- `dives_pkey`: `(id)`

### 外部キー

| 制約名 | カラム | 参照先 | ON DELETE |
|--------|------|------|----------|
| `dives_user_id_fkey` | `user_id` | `public.users(id)` | `CASCADE` |
| `dives_dive_site_id_fkey` | `dive_site_id` | `public.dive_sites(id)` | `RESTRICT` |

ユーザー削除時に紐づくダイブログもまとめて削除される。参照中のダイブサイトの削除は `RESTRICT` で防ぐ（011 FR-009 の DB 安全網）。

### ユニーク制約

| 制約名 | カラム | 補足 |
|--------|------|------|
| `dives_public_slug_key` | `public_slug` | 公開 URL 用。`NULL` は重複可（PostgreSQL のユニーク制約仕様） |
| `dives_user_id_dive_number_key` | `(user_id, dive_number) where dive_number is not null` | 同一ユーザー内で `dive_number` は重複不可。`NULL` は対象外（未入力ログは複数共存可） |

### CHECK 制約

| 制約名 | 内容 |
|--------|------|
| `dives_dive_number_check` | `dive_number is null or dive_number >= 0` |
| `dives_dive_date_check` | `dive_date >= '1900-01-01' and dive_date <= (now() at time zone 'Asia/Tokyo')::date`（JST の当日まで。UTC の `current_date` だと JST 午前に当日が弾かれるため JST 基準に統一） |
| `dives_site_or_location_check` | `(dive_site_id is not null and location is null) or (dive_site_id is null and location is not null and length(trim(location)) > 0)`（旧 `dives_location_check` を置換。`20260616100100`） |
| `dives_visibility_m_check` | `visibility_m is null or visibility_m >= 0` |
| `dives_max_depth_m_check` | `max_depth_m > 0 and max_depth_m <= 300` |
| `dives_avg_depth_m_check` | `avg_depth_m is null or (avg_depth_m > 0 and avg_depth_m <= 300)` |
| `dives_bottom_time_min_check` | `bottom_time_min >= 1` |
| `dives_tank_volume_l_check` | `tank_volume_l is null or tank_volume_l > 0` |
| `dives_o2_percent_check` | `o2_percent is null or (o2_percent >= 0 and o2_percent <= 100)` |
| `dives_pressure_start_bar_check` | `pressure_start_bar is null or pressure_start_bar >= 0` |
| `dives_pressure_end_bar_check` | `pressure_end_bar is null or pressure_end_bar >= 0` |
| `dives_weight_kg_check` | `weight_kg is null or weight_kg >= 0` |
| `dives_location_len_check` | `location is null or char_length(location) <= 120` |
| `dives_dive_type_len_check` | `dive_type is null or char_length(dive_type) <= 40` |
| `dives_weather_len_check` | `weather is null or char_length(weather) <= 60` |
| `dives_wave_len_check` | `wave is null or char_length(wave) <= 60` |
| `dives_current_condition_len_check` | `current_condition is null or char_length(current_condition) <= 60` |
| `dives_gas_type_len_check` | `gas_type is null or char_length(gas_type) <= 40` |
| `dives_suit_type_len_check` | `suit_type is null or char_length(suit_type) <= 40` |
| `dives_equipment_notes_len_check` | `equipment_notes is null or char_length(equipment_notes) <= 1000` |
| `dives_buddy_name_len_check` | `buddy_name is null or char_length(buddy_name) <= 100` |
| `dives_instructor_name_len_check` | `instructor_name is null or char_length(instructor_name) <= 100` |
| `dives_notes_len_check` | `notes is null or char_length(notes) <= 2000` |

> 自由入力テキストの長さ CHECK はアプリ層（`dive.schema.ts` の `.max`）と同値で二重に表現する（`20260619100000_add_dives_text_length_checks.sql`）。

## 4. インデックス

| インデックス名 | カラム | 種別 | 用途 |
|-------------|------|------|------|
| `idx_dives_user_id_dive_date` | `(user_id, dive_date desc)` | btree | 一覧表示（自分のログを日付降順） |
| `idx_dives_user_id_location` | `(user_id, location)` | btree | ポイント名検索 |
| `dives_user_id_dive_number_key` | `(user_id, dive_number) where dive_number is not null` | partial unique btree | ダイブ番号のユーザー内一意制約（兼インデックス） |
| `idx_dives_public_slug` | `(public_slug) where is_public = true` | 部分 btree | Phase 2 の公開 URL 解決 |
| `idx_dives_user_id_dive_site_id` | `(user_id, dive_site_id)` | btree | 本人のサイト別実績集計用（FK インデックス兼用。`20260616100100`） |
| `idx_dives_active` | `(user_id) where deleted_at is null` | 部分 btree | 有効行（未削除）の絞り込み用（`20260620100300`） |
| `idx_dives_public_user_date` | `(user_id, dive_date desc, id desc) where is_public = true` | 部分 btree | タイムライン / 公開ログ一覧のキーセットページネーション用（`20260630100200`） |

主キー `(id)` および `public_slug` のユニーク暗黙インデックスは別途存在。

## 5. RLS（Row Level Security）

RLS は **有効**。書き込みは所有者のみ、読み取りは「本人の未削除ログ」∪「公開の未削除ログ」。

| ポリシー名 | コマンド | 条件 |
|----------|---------|------|
| `users can read own dives` | `SELECT` | `(select auth.uid()) = user_id and deleted_at is null`（`20260620100500` で未削除条件を追加） |
| `authenticated can read public dives` | `SELECT`（`to authenticated`） | `is_public = true and deleted_at is null`（`20260630100200`、spec 021 FR-010） |
| `users can insert own dives` | `INSERT` | `(select auth.uid()) = user_id`（`with check`） |
| `users can update own dives` | `UPDATE` | `(select auth.uid()) = user_id`（`using` / `with check` 両方） |
| `users can delete own dives` | `DELETE` | `(select auth.uid()) = user_id` |

- `auth.uid()` は `(select ...)` でラップし、行ごとに再評価されないようにしている（Supabase の `auth_rls_initplan` 警告対応）
- SELECT は複数ポリシーが OR 結合されるため、認証ユーザーの閲覧可能集合は「本人のログ」∪「公開ログ」になる。非公開かつ他人のログは引き続き不可視
- 論理削除（`deleted_at`）済みのログは本人・公開いずれの読み取りでも露出しない（管理者向けポリシーは復元のため削除済みも参照可）

## 6. トリガー

| トリガー名 | タイミング | 関数 | 内容 |
|----------|----------|------|------|
| `dives_handle_updated_at` | `BEFORE UPDATE` | `public.handle_updated_at()` | `updated_at` を `now()` に更新 |

`handle_updated_at()` は `users` マイグレーションで定義された汎用関数を再利用。

## 7. ER（隣接テーブル）

```mermaid
erDiagram
  users ||--o{ dives : "1:N (user_id)"
```

## 8. 運用ノート

- ユーザー 1 人あたり数百〜数千行が想定上限。アクティブダイバーでも年間 100〜200 本程度
- 一覧表示は `idx_dives_user_id_dive_date` を使用したキーセットページネーション
- `user_id` は Server Action 側で `auth.uid()` から強制セット（クライアント送信値は無視）
- `is_public` / `public_slug` は Phase 1 では使用しないが、後から `ALTER TABLE` が不要なよう先行定義
- Phase 2 の公開機能では `public_slug` をクエリで引くため、`idx_dives_public_slug`（部分インデックス）で高速化

## 9. 関連リソース

- マイグレーション: `supabase/migrations/20260525130000_create_dives.sql`
- 型: `service-front/src/features/dives/types.ts`
- スキーマ: `service-front/src/features/dives/schemas/dive.schema.ts`
- 定数: `service-front/src/features/dives/constants.ts`（`dive_type` / `gas_type` 等の選択肢）
- 機能仕様: [`spec.md`](spec.md) / 実装計画: [`plan.md`](plan.md)
- 関連画面: [`screens/dive-list.md`](screens/dive-list.md) / [`screens/dive-detail.md`](screens/dive-detail.md) / [`screens/dive-new.md`](screens/dive-new.md) / [`screens/dive-edit.md`](screens/dive-edit.md)
- 隣接テーブル: [`users`](../001-auth/data-model.md)

## 10. 変更履歴

| 日付 | マイグレーション | 変更内容 |
|------|---------------|---------|
| 2026-05-25 | `20260525130000_create_dives.sql` | 初版作成 |
| 2026-06-16 | `20260616100100_add_dives_dive_site_id.sql` | `dive_site_id` 追加・`location` nullable 化・`dives_site_or_location_check` 追加・`idx_dives_user_id_dive_site_id` 追加 |
| 2026-06-20 | `20260620100300_add_soft_delete_columns.sql` | `deleted_at` 追加・`idx_dives_active` 追加 |
| 2026-06-20 | `20260620100500_filter_soft_deleted_from_user_reads.sql` | `users can read own dives` に `deleted_at is null` 条件を追加 |
| 2026-06-30 | `20260630100200_add_dives_public_read_policy.sql` | 公開読み取りポリシー `authenticated can read public dives` 追加・`idx_dives_public_user_date` 追加 |
