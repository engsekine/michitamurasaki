# Quickstart: ダイバー種別・ダイバー番号の登録

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

種別の必須選択・番号のインストラクター限定・記録・編集をローカルで検証する手順。実装コードは含めない（タスクは `/speckit-tasks`）。

## 前提
- service-front を起動できること
- 追加マイグレーション（`user_details` の 2 列 + CHECK + `handle_new_user` 再定義）を適用:
  ```bash
  cd <repo root> && supabase migration up
  ```

## 検証シナリオ

### シナリオ A: メール登録 — 種別必須・番号は instructor 限定（US1 / US2）
1. `/signup` で必須項目を入力。**ダイバー種別を未選択**で「新規登録」→ **期待**: エラー（種別の選択を促す）
2. 種別「一般ダイバー」を選ぶ → **期待**: ダイバー番号欄は表示されない。そのまま登録できる
3. 種別「インストラクター」を選ぶ → **期待**: ダイバー番号欄が現れる。番号を入れて登録
4. **期待（記録）**: `user_details.diver_type` が選択値、instructor のときのみ `diver_number` が保存（Supabase Studio で確認）

### シナリオ B: Google 初回ログイン（US1 / US2）
1. 未登録 Google アカウントで初回ログイン → `/profile-completion`
2. シナリオ A 同様に種別必須・instructor 時のみ番号欄。送信 → `/dives` 到達＋記録

### シナリオ C: プロフィール編集（FR-009）
1. 既存ユーザー（種別 NULL）で `/settings/profile` を開く → **期待**: 種別未選択のまま他項目を編集・保存できる（ブロックされない）
2. 種別を「インストラクター」にして番号を保存 → 反映
3. 種別を「一般ダイバー」に変更して保存 → **期待**: `diver_number` が NULL に戻る（破棄）

### シナリオ D: バリデーション
1. instructor で番号に 51 文字 → **期待**: エラーで拒否
2. instructor で番号空 → **期待**: 任意のため登録/保存できる

### シナリオ E: アクセシビリティ（SC-004）
1. キーボードのみで種別ラジオの選択・番号欄の入力・送信ができる
2. axe で該当画面の WCAG 2.1 AA 違反ゼロ

## 自動テスト（受け入れ対応）
| テスト | 対象 | 受け入れ |
|--------|------|----------|
| Vitest | `requiredDiverFields` / `optionalDiverFields`（必須/任意・instructor 限定・50 文字） | FR-004〜009 |
| Vitest | `signUp`/`completeProfile`/`updateProfile` と mapper（番号の instructor 限定・general で null 化） | FR-005/007/009 |
| Storybook + Playwright a11y | 種別ラジオ＋条件付き番号欄を含むフォーム | SC-004 |
| Playwright E2E | シナリオ A〜D | SC-001/002/003 |

## 完了の目安
- シナリオ A〜E が手動 / E2E で再現・合格
- 既存の 001 / 016 / 018 サインアップ・編集が回帰していない
- 既存 user_details 行が両列 NULL（grandfather）で CHECK 違反しない
