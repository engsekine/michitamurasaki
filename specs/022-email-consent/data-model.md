# Data Model: メール配信許可（オプトイン）

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

新規テーブルは追加しない。既存 `public.user_details`（[001-auth/data-model.md](../001-auth/data-model.md) が正）にメール配信同意用の 2 列を追加し、`handle_new_user` トリガー（016 で OAuth 分岐、018 で同意列を追記済み）を再定義する。マイグレーション 1 本。

## 変更 1: `user_details` への列追加

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|----|------|-----------|------|
| `is_email_opted_in` | `boolean` | NO | `false` | お知らせメール（任意配信）の配信を許可しているか。既存ユーザー・未選択は `false` |
| `email_opted_in_at` | `timestamptz` | YES | — | 配信を許可した日時。不許可（`false`）のときは NULL |

### 制約
- CHECK `user_details_email_opt_in_check`: `is_email_opted_in = (email_opted_in_at is not null)`
  - 「許可（true）なら日時を持つ」「不許可（false）なら日時は NULL」のみ許可し、片方だけ埋まる不整合を防ぐ。
- `is_email_opted_in` は `not null default false`（既存ユーザーを grandfather しつつ、オプトインのデフォルト不許可を担保、FR-002 / FR-010）。
- お知らせメールの配信抑止（FR-008）はアプリ層・配信処理側（次フィーチャー）が `is_email_opted_in = true` のみを対象にすることで担保する。

### 既存行の扱い
- マイグレーション適用時、既存 `user_details` 行は `is_email_opted_in = false` / `email_opted_in_at = NULL`（明示同意の無い既存ユーザーは配信対象外、SC-005）。

## 変更 2: `handle_new_user()` トリガー再定義（016 / 018 の分岐を維持）

メール経路（`raw_user_meta_data ? 'nickname'`）の `user_details` INSERT に配信同意を追加する。`security definer set search_path = ''` 維持。

```sql
-- 擬似コード（メール経路の INSERT 部に追記）
insert into public.user_details (
    user_id, last_name, ..., weight_kg,
    terms_version, terms_agreed_at,
    is_email_opted_in, email_opted_in_at
) values (
    new.id, ...,
    new.raw_user_meta_data->>'terms_version',
    case when new.raw_user_meta_data ? 'terms_version' then now() else null end,
    -- ★022: signUp の options.data 経由。欠落時は false（CHECK を満たすため日時は NULL）
    coalesce((new.raw_user_meta_data->>'email_opt_in')::boolean, false),
    case when (new.raw_user_meta_data->>'email_opt_in')::boolean then now() else null end
);
```

- **`email_opted_in_at` は条件付き**: `email_opt_in` が真のときだけ `now()`、それ以外は NULL。これにより CHECK `is_email_opted_in = (email_opted_in_at is not null)` を常に満たす。
- メタに `email_opt_in` が無い（旧クライアント等）場合は `coalesce` で `false` / NULL となり、CHECK 違反でサインアップを壊さない。
- Google 初回（`nickname` 無し）は従来どおり `user_details` を作らない。同意記録は `completeProfile` の INSERT が行う。

## 記録経路まとめ

| 経路 | 書き込み主体 | is_email_opted_in | email_opted_in_at |
|------|--------------|-------------------|--------------------|
| メール登録 | `handle_new_user` トリガー | `raw_user_meta_data->>'email_opt_in'`（signUp が渡す。既定 false） | 許可時のみ `now()`、不許可は NULL |
| Google 初回 | `completeProfile` の INSERT | `input.emailOptIn` | 許可時のみ登録時刻、不許可は NULL |
| 登録後の変更 | `updateProfile` の UPDATE | トグル値 | OFF→ON で `now()`、ON のまま保持、ON→OFF で NULL |
| 既存ユーザー | — | `false`（grandfather） | NULL |

## RLS
`user_details` の既存ポリシー（SELECT/UPDATE 本人 = 001、INSERT 本人 = 016）が新列もそのままカバーする。**新規ポリシーは不要**。設定画面のトグル更新は本人 UPDATE ポリシーで許可される。

## 関連リソース
- 既存定義（正）: [001-auth/data-model.md](../001-auth/data-model.md)
- 既存トリガー（直近）: `supabase/migrations/20260626100000_add_terms_agreement.sql`（018）
- 追加マイグレーション: `supabase/migrations/20260701120000_add_email_opt_in.sql`（CHECK 名 `user_details_email_opt_in_check`）
- 生成型: `packages/supabase/src/types.ts` の `user_details`（Row/Insert/Update）に `is_email_opted_in` / `email_opted_in_at` を反映する
