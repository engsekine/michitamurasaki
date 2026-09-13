# Data Model: `public.certifications`

## メタ情報

| 項目 | 内容 |
|------|------|
| スキーマ | `public` |
| テーブル名 | `certifications` |
| 説明 | ユーザーが保有するダイビングライセンス資格 |
| 主キー | `id` |
| RLS | 有効 |
| 関連機能 | [006 ダイビングライセンス保有資格管理](spec.md) |
| ステータス | 確定 |

## 1. 概要

ユーザーが取得したダイビングライセンス資格 1 件を 1 行で保持するテーブル。1 ユーザーが複数の資格を持つ 1:N 関係（OW → AOW → Rescue のような段階取得が一般的なため）。

保有期間（取得日からの経過年月）は導出値のためカラムに持たない（[research.md R3](research.md) 参照）。

## 2. カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|----|------|----------|------|
| `id` | `uuid` | NO | `gen_random_uuid()` | 主キー |
| `user_id` | `uuid` | NO | — | 所有ユーザー。`users(id)` を参照。`on delete cascade` |
| `agency` | `text` | NO | — | 指導団体。`padi` / `naui` / `ssi` / `bsac` / `cmas` / `other` の 6 値（CHECK 制約） |
| `rank` | `text` | NO | — | 資格ランク名（自由入力）。trim 後 1 文字以上・60 文字以内 |
| `acquired_on` | `date` | NO | — | 資格取得日。1900-01-01 〜 当日。「当日」は JST 基準（`todayInJst`）で yup / Server Action が検証し、DB CHECK は JST 基準の安全網（`(now() at time zone 'Asia/Tokyo')::date + 1` まで） |
| `diver_number` | `text` | YES | — | C カードに記載されるダイバーナンバー（任意）。60 文字以内 |
| `instructor_number` | `text` | YES | — | 認定したインストラクターのナンバー（任意）。60 文字以内 |
| `trained_by` | `text` | YES | — | 講習を受けた指導者・ショップ名（任意）。120 文字以内 |
| `acquired_location` | `text` | YES | — | 資格を取得した場所（任意）。120 文字以内 |
| `dive_id` | `uuid` | YES | — | 資格を取得したダイブログ（任意）。`dives(id)` を参照。`on delete set null`（ログ削除で紐づけのみ解除され資格は残る） |
| `created_at` | `timestamptz` | NO | `now()` | 作成日時 |
| `updated_at` | `timestamptz` | NO | `now()` | 更新日時（トリガで自動更新） |

### バリデーション（DB 制約に乗らないもの）

| ルール | 実装場所 | 理由 |
|--------|---------|------|
| `acquired_on` ≦ 当日（JST 基準・`todayInJst`） | yup + Server Action | 厳密な未来日付拒否はアプリ層で行う。DB CHECK は JST 基準（`(now() at time zone 'Asia/Tokyo')::date + 1`）の安全網とし、`+1` でタイムゾーン端の余裕を残す（`20260701090000_alter_date_checks_to_jst.sql` で UTC `current_date` から JST へ統一） |
| `acquired_on` ≧ `user_details.birth_on` | Server Action | クロステーブル参照のため CHECK 制約にできない（[research.md R4](research.md)）。`user_details` が取得できない場合は登録・更新を拒否してエラー表示する |
| 重複登録時のユーザー向けエラーメッセージ | Server Action | 一意制約違反（23505）を捕捉して変換（[research.md R5](research.md)） |
| スペシャリティタグの個数上限（10 個） | yup | 個数は DB 制約にできないためアプリ層で制限。タグ 1 つの文字数（30 文字）は `certification_tags` の CHECK と二重に検証 |
| `dive_id` が自分のダイブログであること | Server Action | FK 制約はログの存在しか保証しない。`user_id` の明示条件付き select で本人所有を検証し（021 の公開読み取りポリシー以降、RLS スコープだけでは他人の公開ログが可視のため）、他人の ID は「見つかりません」として拒否 |

## 3. 制約・インデックス

| 名前 | 種別 | 定義 |
|------|------|------|
| `certifications_pkey` | 主キー | `(id)` |
| `certifications_user_id_fkey` | 外部キー | `user_id references public.users(id) on delete cascade` |
| `certifications_user_id_agency_rank_key` | ユニーク | `(user_id, agency, rank)` — 同一団体・同一ランクの重複登録防止 |
| `certifications_agency_check` | CHECK | `agency in ('padi', 'naui', 'ssi', 'bsac', 'cmas', 'other')` |
| `certifications_rank_check` | CHECK | `length(trim(rank)) > 0 and char_length(rank) <= 60` |
| `certifications_acquired_on_check` | CHECK | `acquired_on >= '1900-01-01' and acquired_on <= (now() at time zone 'Asia/Tokyo')::date + 1`（JST 基準。+1 はタイムゾーン端の許容。厳密な当日判定はアプリ層） |
| `idx_certifications_user_id_acquired_on` | インデックス | `(user_id, acquired_on desc)` — 一覧の取得日降順表示用。同日取得は `created_at desc` を第 2 ソートキーとする（クエリ側で指定） |
| `certifications_dive_id_fkey` | 外部キー | `dive_id references public.dives(id) on delete set null` |
| `idx_certifications_dive_id` | インデックス | `(dive_id)` — 外部キーカラム用 |

## 4. RLS ポリシー

`alter table public.certifications enable row level security;` のうえで、本人のみ全操作可:

| ポリシー名 | 操作 | 条件 |
|-----------|------|------|
| `"users can read own certifications"` | select | `using ((select auth.uid()) = user_id)` |
| `"users can insert own certifications"` | insert | `with check ((select auth.uid()) = user_id)` |
| `"users can update own certifications"` | update | `using` + `with check` 両方で `(select auth.uid()) = user_id` |
| `"users can delete own certifications"` | delete | `using ((select auth.uid()) = user_id)` |

## 5. トリガ

| トリガ名 | タイミング | 内容 |
|---------|----------|------|
| `certifications_handle_updated_at` | `before update` | `public.handle_updated_at()`（users マイグレーションで定義済み）で `updated_at` を自動更新 |

## 6. マイグレーションファイル

```
supabase/migrations/20260612100000_create_certifications.sql      # テーブル本体（詳細カラム・dive_id FK 含む）
supabase/migrations/20260612120100_create_certification_tags.sql  # スペシャリティタグ子テーブル
```

- テーブル作成・コメント・ユニーク制約・インデックス・RLS ポリシー・トリガを 1 ファイルにまとめる（強い依存関係があるため 1 マイグレーション 1 目的の範囲内）
- `comment on` でテーブル・主要カラムの意図を記録する

## 6.5. 子テーブル: `public.certification_tags`

資格に付与するスペシャリティタグ（1 資格 : 多タグ）。カンマ区切り・配列カラムを避け 1NF を守るため子テーブルで保持する（`rules/sql.md` の `user_tags` パターン）。

### カラム定義

| カラム | 型 | NULL | 説明 |
|-------|----|------|------|
| `certification_id` | `uuid` | NO | 親資格。`certifications(id)` を参照。`on delete cascade` |
| `tag` | `text` | NO | タグ名（自由入力）。trim 後 1 文字以上・30 文字以内（CHECK 制約） |

- 主キー: `(certification_id, tag)` — 同一資格内のタグ重複を防止
- タイムスタンプは持たない（値そのものが主キーで、更新は削除 + 再挿入で行うため）

### RLS ポリシー

所有者判定は親 `certifications.user_id` への `exists` サブクエリに委譲する。update ポリシーは意図的に定義しない（行の更新操作が存在しないため）:

| ポリシー名 | 操作 |
|-----------|------|
| `"users can read own certification tags"` | select |
| `"users can insert own certification tags"` | insert |
| `"users can delete own certification tags"` | delete |

### 整合性の注意

資格本体とタグの書き込みは 2 リクエストに分かれる（トランザクション化には RPC が必要だが、タグは補助情報のため導入しない）。タグの保存に失敗した場合、Server Action は資格本体は保存されたままエラーメッセージで編集画面からの再保存を促す。

## 7. 導出値: 保有期間

| 項目 | 内容 |
|------|------|
| 定義 | `acquired_on` から現在日までの経過年月（月数は切り捨て） |
| 実装 | `features/certifications/lib/heldPeriod.ts` の純粋関数。DB には保存しない |
| 表示例 | 「3年2ヶ月」「11ヶ月」「0ヶ月」（取得当日） |
| 境界 | 月末またぎ（1/31 取得 → 2/28 時点）は「日が足りなければ 1 ヶ月未満」として切り捨て |
