# Quickstart: 新規登録時の利用規約同意

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

利用規約同意の必須化と記録をローカルで検証する手順。実装コードは含めない（タスクは `/speckit-tasks`）。

## 前提
- service-front を起動できること（メール経路はローカル Supabase + Inbucket、Google 経路は 016 の設定が必要）
- 追加マイグレーション（`user_details` の 2 列 + `handle_new_user` 再定義）を適用すること:
  ```bash
  cd <repo root>
  supabase migration up
  ```

## 検証シナリオ

### シナリオ A: メール登録 — 未チェックは登録不可（US1 / SC-001）
1. `/signup` で必須項目を全て入力
2. 「利用規約に同意する」チェックを**入れずに**「新規登録」
3. **期待**: 登録されず、同意を促すエラーが表示される（`role="alert"`）
4. チェックを入れて送信 → **期待**: 確認メール送信フローに進む（既存どおり）

### シナリオ B: メール登録 — 同意の記録（SC-005）
1. シナリオ A でチェックして登録完了（確認メールのリンクで TOP（`/`）まで）
2. **期待**: 当該ユーザーの `user_details.terms_version` が `CURRENT_TERMS_VERSION`、`terms_agreed_at` に日時が記録されている（Supabase Studio で確認）

### シナリオ C: Google 初回ログイン — 未チェックは利用開始不可（US2）
1. 未登録 Google アカウントで初回ログイン → `/profile-completion`
2. 同意チェックを**入れずに**送信 → **期待**: 補完が完了せず同意を促す
3. チェックを入れて送信 → **期待**: TOP（`/`）到達。`user_details` に `terms_version` / `terms_agreed_at` が記録される

### シナリオ D: 規約リンクと入力保持（FR-005）
1. `/signup` で数項目入力後、チェックボックス内の「利用規約」リンクを押す
2. **期待**: `/terms` が別タブで開き、元のフォームの入力は保持されている

### シナリオ E: 既存ログインは非適用（FR-007）
1. 既存ユーザーで `/login` → **期待**: 利用規約同意は要求されない

### シナリオ F: アクセシビリティ（SC-004）
1. キーボードのみでチェックの ON/OFF・規約リンク・送信が操作できる
2. axe（Playwright）でフォーム表示状態の WCAG 2.1 AA 違反ゼロ

## 自動テスト（受け入れ対応）
| テスト | 対象 | 受け入れ |
|--------|------|----------|
| Vitest | 両スキーマの `agreedToTerms`、`FormCheckbox`、`signUp`/`completeProfile` ガード・記録、mapper | FR-002/003/008/010 |
| Storybook + Playwright a11y | `FormCheckbox` / `/signup` / `/profile-completion` | SC-004 |
| Playwright E2E | シナリオ A〜E | SC-001/002/003/005 |

## 完了の目安
- シナリオ A〜F が手動 / E2E で再現・合格
- 既存のメール/Google サインアップ（001 / 016）が回帰していない
- 既存ユーザー行が grandfather（terms 列 NULL）のままで不整合がない
