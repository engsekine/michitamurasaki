# Quickstart: メール配信許可（オプトイン）の検証

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

実装が spec を満たすかを手動 + 自動で確認する検証ガイド。詳細な実装は [data-model.md](data-model.md) / [contracts/](contracts/) を参照。

## 前提

- ローカル Supabase スタックが起動済み（`supabase start`）でマイグレーション適用済み（`supabase db reset`）
- `service-front` を起動（`npm run dev --workspace service-front`）

## 自動テスト

```sh
# 単体（スキーマ・Server Actions・mapper・EmailOptInField）
npm run test --workspace service-front

# a11y / E2E（Playwright + axe-core）
npm run test:e2e --workspace service-front

# DB lint（マイグレーション・RLS・search_path）
supabase db lint
```

## 検証シナリオ

### A. メール登録でオプトイン（US1 / FR-001〜FR-005）
1. `/signup` を開く → メール配信許可チェックボックスが**初期オフ**で表示される（FR-002）
2. 必須項目を入力し、チェックを**オンにして**登録
3. `user_details` に `is_email_opted_in = true` / `email_opted_in_at` が非 NULL で記録される

### B. メール登録でチェックせず登録（US1 / FR-003）
1. `/signup` で必須項目のみ入力し、メール配信チェックは**触れず**に登録
2. 登録は正常完了し、`is_email_opted_in = false` / `email_opted_in_at = NULL`

### C. Google 初回ログインでオプトイン（US1 / FR-001）
1. Google で初回ログイン → `/profile-completion` でメール配信チェックが表示される
2. オンにして完了 → `is_email_opted_in = true` / `email_opted_in_at` 非 NULL

### D. 設定画面で許可に変更（US2 / FR-006 / FR-007）
1. 不許可で登録したユーザーで `/settings/profile` を開く → トグルが**オフ**表示（FR-007）
2. オンにして保存 → `is_email_opted_in = true` / `email_opted_in_at` に保存時刻
3. 再表示するとオン表示が維持される（SC-004）

### E. 設定画面で撤回（US2 / FR-006）
1. 許可済みユーザーで `/settings/profile` のトグルをオフにして保存
2. `is_email_opted_in = false` / `email_opted_in_at = NULL`（撤回でクリア）
3. ON 維持で他項目だけ変更して保存した場合、`email_opted_in_at` は最初の許可日時を保持する

### F. 既存ユーザーの grandfather（FR-010 / SC-005）
1. マイグレーション適用前から存在するユーザー行を確認
2. `is_email_opted_in = false` / `email_opted_in_at = NULL` で、お知らせメール配信対象に含まれない

### G. アクセシビリティ
- チェックボックスは label 関連付け・補足文の `aria-describedby`・キーボード（Space）操作が可能
- axe-core で対象画面（signup / profile-completion / settings/profile）に WCAG 2.1 AA 違反がない

## 完了の目安
- シナリオ A〜F が期待通り（`user_details` の 2 列が CHECK を満たして記録/更新される）
- `supabase db lint` がパス（CHECK・RLS・トリガー search_path）
- 単体・a11y テストがグリーン
- お知らせメール配信処理（次フィーチャー）は `is_email_opted_in = true` のみを対象にできる前提が整っている（FR-008）
