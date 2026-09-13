# Contract: Server Actions（利用規約同意）

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

既存 `service-front/src/features/auth/server/actions.ts` の 2 アクションを変更。戻り値は既存 `ActionResult`。

## `signUp(input)` 変更

| 項目 | 内容 |
|------|------|
| 入力追加 | `SignUpInput` に `agreedToTerms: boolean` を追加 |
| ガード（FR-008） | 先頭で `input.agreedToTerms !== true` → `actionFailure('利用規約に同意してください')`（Supabase 呼び出し前に弾く） |
| 記録 | `options.data` に `terms_version: CURRENT_TERMS_VERSION` を追加（`handle_new_user` がメール経路 INSERT で `terms_version` と `terms_agreed_at = now()` を書く） |
| 既存挙動 | メール確認フロー・重複メール判定等は変更なし |

## `completeProfile(input)` 変更

| 項目 | 内容 |
|------|------|
| 入力追加 | `CompleteProfileInput` に `agreedToTerms: boolean` を追加 |
| ガード（FR-008） | `input.agreedToTerms !== true` → `actionFailure('利用規約に同意してください')` |
| 記録 | `toUserDetailsInsert` を拡張し `terms_version = CURRENT_TERMS_VERSION` / `terms_agreed_at`（登録時刻）を INSERT に含める |
| 既存挙動 | 本人 INSERT・PK 重複の冪等処理・TOP（`/`）redirect は変更なし |

## 定数

`service-front/src/shared/constants/terms.ts`:
```ts
export const CURRENT_TERMS_VERSION = '2026-06-26'; // 規約改定日に合わせて更新
```

## 受け入れ対応
FR-003 / FR-008 / FR-009 / FR-010、SC-001 / SC-005

## テスト観点（Vitest）
- `signUp`: `agreedToTerms=false` で `actionFailure`・Supabase 未呼び出し / `true` で `options.data.terms_version` を含む
- `completeProfile`: `agreedToTerms=false` で `actionFailure` / `true` で INSERT ペイロードに `terms_version` / `terms_agreed_at` を含む
- `toUserDetailsInsert`: terms 列が正しくマップされる
