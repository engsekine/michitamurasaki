# Quickstart: ユーザー ID とプロフィール URL（034 Rev.2）

## 前提

```bash
npx supabase start && npx supabase db reset   # seed: taro / buddy-taro / rename-saburo（handle 付き）
npm run dev --workspace service-front
```

## シナリオ 1: 新規登録でユーザー ID を設定（US1/US2）

1. `/signup` を開く → 「ユーザー ID」欄（説明文付き）がある
2. 空のまま送信 → **期待**: 「ユーザー ID を入力してください」
3. `たろう` / `a b` / `ab` / `1abc` / 31 文字 → **期待**: 形式エラー
4. `taro`（既存）→ **期待**: 「既に使われています」
5. `TaroDiver2` で登録 → **期待**: 登録成功。マイプロフィール URL が `/users/tarodiver2`（小文字化）

## シナリオ 2: URL と導線（US1）

1. `/users/buddy-taro` → buddy のプロフィール（表示名はニックネームのまま）
2. `/users/BUDDY-TARO` → 同一ユーザーに解決（FR-002 相当の正規化）
3. タイムライン・フォロー一覧・バディ表示・通知からの遷移がすべて `/users/<handle>` になる
4. `/users/<uuid>` → `/users/<handle>` へ転送（followers 下層も維持）
5. 存在しない handle / uuid → 404

## シナリオ 3: ユーザー ID の変更（US3）

1. 会員情報で `rename-saburo` → `rename-shiro` に変更 → **期待**: 保存成功・マイプロフィール URL が即時切り替わる（5 秒以内 = SC-004）
2. `/users/rename-saburo` → 404
3. `/users/<rename の uuid>` → `/users/rename-shiro` へ転送
4. 元に戻す（後始末）

## シナリオ 4: Google 補完（US1）

1. 未登録 Google アカウントで初回ログイン → `/profile-completion` に「ユーザー ID」欄（必須）
2. 設定して完了 → マイプロフィールが `/users/<handle>` になる
（ローカルで Google 設定が無い場合は補完フォームの単体テスト・schema テストで代替）

## シナリオ 5: 退行確認

- `/users/search` のユーザー検索・プロフィール表示内容・フォロー操作が従来どおり（FR-009/010）
- ニックネーム（日本語）は表示名として全画面で従来どおり表示される

## 自動テスト

```bash
cd service-front && npx vitest run --project unit
npx playwright test tests/profile-url.spec.ts
```
