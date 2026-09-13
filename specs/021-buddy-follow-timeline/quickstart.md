# Quickstart: バディ・フォロー・タイムライン 検証ガイド

本機能をエンドツーエンドで検証する手順。詳細な実装は data-model.md / contracts/ を参照（本書は実行・検証用）。

## 前提

- service-front の依存導入済み（リポジトリルートで `npm install`）
- Supabase ローカル環境が起動可能（`supabase start`）
- テストユーザーが seed 済み（`supabase/seed.sql.template` 由来）

## セットアップ

```bash
# 1. マイグレーション適用（新規 2 テーブル + dives 公開ポリシー。get_public_dive は後続 migration で撤去済み）
supabase db reset    # または supabase migration up

# 2. 型再生成（@repo/supabase の Database 型に新テーブルを反映）
#    packages/supabase の型生成スクリプトに従う

# 3. service-front 起動
npm run dev --workspace service-front
```

検証対象マイグレーション:
- `20260630100000_create_dive_log_buddies.sql`
- `20260630100100_create_user_follows.sql`
- `20260630100200_add_dives_public_read_policy.sql`
- `20260630100300_create_get_public_dive_fn.sql`

## シナリオ別検証

### S1. バディ記録（US1 / FR-001〜006）

1. ログ編集で登録ユーザー＋フリーテキストのバディを追加し保存
2. ログ詳細で両方が一覧表示され、登録ユーザーはプロフィール（034 以降はユーザー ID の URL）へ遷移できる
3. 自分自身をバディに選べない（トリガ拒否）ことを確認
4. 期待: `dive_log_buddies` に 2 行、自己タグは INSERT 失敗

### S2. 公開/非公開（US2 / FR-007〜011・SC-002/005）

1. 新規ログが既定 `is_public=false` で保存される
2. 公開トグル → 共有リンク `{SITE_URL}/dives/[id]` が表示され、別アカウント（ログイン済み）から閲覧可
3. 別アカウントで `/dives/[id]` を開くと全項目を閲覧できるが、編集・削除・公開設定・PDF 出力は表示されない
4. 非公開へ戻す → 別アカウントの `/dives/[id]` は 404/不可（5 秒以内）
5. 未ログインで `/dives/[id]` にアクセス → `/login` へ誘導され閲覧不可（匿名共有は廃止）
6. 期待: 非公開かつ他人のログは一覧・最近のダイブログ・タイムライン・検索・直URL のいずれでも不可視

### S3. フォロー/解除（US3 / FR-012〜016・SC-003）

1. アカウント A で B のプロフィールを開きフォロー → 件数が即更新
2. B の公開ログ一覧が A から閲覧でき、B の非公開は含まれない
3. フォロー解除で関係・件数が戻る
4. 自己フォロー・二重フォローが不可（DB 制約）

### S4. TOP タイムライン（US4 / FR-017〜021・SC-004）

1. A が複数ユーザーをフォローし、各々に公開ログがある状態で TOP を開く
2. 公開ログが新しい順（dive_date desc, id desc）に最大 20 件表示（2 秒以内）
3. 項目クリックで該当ログ詳細へ遷移
4. フォロー 0 / 公開ログ 0 で空状態（フォロー導線）。非公開は決して出ない

### S5. バディ検索（US5 / FR-022/023・SC-006）

1. `/dives?buddy=<userId>` / `?buddy_name=Taro` で該当ログのみ返る（1 秒以内）
2. 閲覧権限のあるログ（本人 + 閲覧可能な公開）以外は結果に出ない
3. 本人除去済みタグ（`removed_by_buddy=true`）はヒットしない

### S6. バディ本人除去（FR-024a/b）

1. B が、A のログに付いた「B タグ」を本人除去（`removeBuddyTagOfSelf`）
2. 当該タグが全経路で非表示になる
3. A が同じ B を再タグ付けできない（再 INSERT ブロック）

## RLS 重点テスト（SC-002 = 事故 0）

| 経路 | 非公開・他人ログが漏れないこと |
|---|---|
| 直 URL（`/dives/[id]`） | ✓（非公開・他人ログは 404、公開ログは閲覧のみ） |
| 一覧（`/dives`）・最近のダイブログ（TOP） | ✓（本人 `user_id` 限定。他人の公開ログも混ざらない） |
| タイムライン | ✓ |
| 公開ログ一覧（プロフィール） | ✓ |
| 検索（バディ含む） | ✓ |
| エクスポート（`/dives/export`） | ✓（`ownerId` で本人限定。他人の公開ログの ids 指定を弾く） |
| 編集/削除（`updateDive`/`deleteDive`・`/dives/[id]/edit`） | ✓（owner チェックで他人ログは不可） |

## 自動テスト

```bash
# 単体（マッパー・検索パラメータ・バリデーション・タイムライン整形）
npm run test --workspace service-front
# 新規コンポーネントは /generate-with-tests で Vitest/Storybook/Playwright a11y 同梱
```
