# Data Model: ダイバー種別・ダイバー番号の登録

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

新規テーブルは追加しない。既存 `public.user_details`（[001-auth/data-model.md](../001-auth/data-model.md) が正）に 2 列を追加し、`handle_new_user` トリガー（016/018 で分岐済み）を再定義する。マイグレーション 1 本。

## 変更 1: `user_details` への列追加

| カラム | 型 | NULL | 説明 |
|--------|----|------|------|
| `diver_type` | `text` | YES | ダイバー種別。`instructor`（インストラクター）/ `general`（一般ダイバー）。新規登録では必須だが既存ユーザーは NULL（grandfather） |
| `diver_number` | `text` | YES | ダイバー番号（認定番号など）。**インストラクターのみ**・任意・50 文字以内。それ以外は NULL |

### 制約（CHECK）
- `user_details_diver_type_check`: `diver_type is null or diver_type in ('instructor','general')`
- `user_details_diver_number_length_check`: `diver_number is null or char_length(trim(diver_number)) between 1 and 50`
- `user_details_diver_number_instructor_check`: **`diver_number is null or diver_type = 'instructor'`**（一般ダイバー / 未設定で番号が残らない）

### 既存行の扱い
- マイグレーション適用時、既存行は両列 NULL（過去登録に種別を捏造しない）。プロフィール編集から後から設定可（FR-009）。

## 変更 2: `handle_new_user()` 再定義（016/018 の分岐を維持）

メール経路（`raw_user_meta_data ? 'nickname'`）の `user_details` INSERT に `diver_type` / `diver_number` を追記する。`security definer set search_path = ''` 維持。

```sql
-- 擬似コード（メール経路 INSERT に追記）
diver_type  = new.raw_user_meta_data->>'diver_type',
-- 番号は instructor のときのみ（CHECK 整合）。nullif で空文字は NULL に
diver_number = case
    when new.raw_user_meta_data->>'diver_type' = 'instructor'
        then nullif(new.raw_user_meta_data->>'diver_number', '')
    else null
end
```

- Google 初回（`nickname` 無し）は従来どおり `user_details` を作らない。記録は `completeProfile` の INSERT。

## 記録経路まとめ

| 経路 | 書き込み主体 | diver_type | diver_number |
|------|--------------|-----------|--------------|
| メール登録 | `handle_new_user` トリガー | meta（`signUp` が渡す） | instructor のときのみ meta 値 |
| Google 初回 | `completeProfile` の INSERT | input | instructor のときのみ input 値 |
| プロフィール編集 | `updateProfile` の UPDATE | input（任意・未選択可） | instructor のときのみ。一般に変更時は NULL |
| 既存ユーザー | — | NULL（grandfather） | NULL |

## バリデーション（アプリ側 yup・DB CHECK と一致）

| 項目 | ルール |
|------|--------|
| `diver_type`（登録） | `instructor` / `general` の必須選択 |
| `diver_type`（編集） | 任意（未選択＝NULL 可） |
| `diver_number` | `instructor` のときのみ・50 文字以内・空白のみ不可。`general`/未選択では送信値を NULL 化 |

## RLS
`user_details` の既存ポリシー（SELECT/UPDATE 本人 = 001、INSERT 本人 = 016）が新列もカバー。**新規ポリシー不要**。

## 関連リソース
- 既存定義（正）: [001-auth/data-model.md](../001-auth/data-model.md)
- 直近トリガー: `supabase/migrations/20260626100000_add_terms_agreement.sql`（018 で再定義済みの `handle_new_user`）
- 追加マイグレーション: `supabase/migrations/20260629100000_add_diver_type.sql`
- 定数: `service-front/src/shared/constants/diver-type.ts`
