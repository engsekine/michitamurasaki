# Data Model: 新規登録時の利用規約同意

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

新規テーブルは追加しない。既存 `public.user_details`（[001-auth/data-model.md](../001-auth/data-model.md) が正）に同意記録用の 2 列を追加し、`handle_new_user` トリガー（016 で分岐済み）を再定義する。マイグレーション 1 本。

## 変更 1: `user_details` への列追加

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|----|------|-----------|------|
| `terms_version` | `text` | YES | — | 同意した利用規約のバージョン（例 `2026-06-26`）。未登録（feature 以前）は NULL |
| `terms_agreed_at` | `timestamptz` | YES | — | 利用規約に同意した日時。未登録は NULL |

### 制約
- CHECK `user_details_terms_agreement_check`: `(terms_version is null) = (terms_agreed_at is null)`
  - 「両方 NULL（未記録/grandfather）」または「両方 NOT NULL（記録済み）」のみ許可し、片方だけ埋まる不整合を防ぐ。
- NOT NULL にはしない（既存ユーザーを grandfather するため）。未同意登録の防止はアプリ層のガード（FR-008）で担保する。

### 既存行の扱い
- マイグレーション適用時、既存 `user_details` 行は両列 NULL のまま（過去の登録に遡って同意を捏造しない）。

## 変更 2: `handle_new_user()` トリガー再定義（016 の分岐を維持）

メール経路（`raw_user_meta_data ? 'nickname'`）の `user_details` INSERT に同意情報を追加する。`security definer set search_path = ''` 維持。

```sql
-- 擬似コード（メール経路の INSERT 部に追記）
insert into public.user_details (
    user_id, last_name, ..., weight_kg,
    terms_version, terms_agreed_at
) values (
    new.id, ...,
    new.raw_user_meta_data->>'terms_version',  -- signUp の options.data 経由
    -- ⚠️ CHECK「両方 NULL or 両方 NOT NULL」を満たすため、terms_version が無いときは
    --    agreed_at も NULL にする（無条件 now() だと version 欠如時に CHECK 違反でサインアップ失敗）
    case when new.raw_user_meta_data ? 'terms_version' then now() else null end
);
```

- **terms_agreed_at は条件付き**にする（`terms_version` がメタに存在するときのみ `now()`）。本 feature 適用後は `signUp` が常に `terms_version` を渡すため通常は常時記録されるが、旧クライアント等で欠落した場合でも CHECK 違反でサインアップを壊さないための防御。
- Google 初回（`nickname` 無し）は従来どおり `user_details` を作らない。同意記録は `completeProfile` の INSERT が行う。

## 記録経路まとめ

| 経路 | 書き込み主体 | terms_version | terms_agreed_at |
|------|--------------|---------------|------------------|
| メール登録 | `handle_new_user` トリガー | `raw_user_meta_data->>'terms_version'`（signUp が `CURRENT_TERMS_VERSION` を渡す） | `now()` |
| Google 初回 | `completeProfile` の INSERT | `CURRENT_TERMS_VERSION` | 登録時刻 |
| 既存ユーザー | — | NULL（grandfather） | NULL |

## RLS
`user_details` の既存ポリシー（SELECT/UPDATE 本人 = 001、INSERT 本人 = 016）が新列もそのままカバーする。**新規ポリシーは不要**。

## 関連リソース
- 既存定義（正）: [001-auth/data-model.md](../001-auth/data-model.md)
- 既存トリガー: `supabase/migrations/20260623100000_alter_handle_new_user_for_oauth.sql`（016）
- 追加マイグレーション: `supabase/migrations/20260626100000_add_terms_agreement.sql`（CHECK 名 `user_details_terms_agreement_check`）
- 生成型: `packages/supabase/src/types.ts` の `user_details`（Row/Insert/Update）に `terms_version` / `terms_agreed_at` を反映済み
- 規約バージョン定数: `service-front/src/shared/constants/terms.ts`（`CURRENT_TERMS_VERSION = '2026-06-26'`）
