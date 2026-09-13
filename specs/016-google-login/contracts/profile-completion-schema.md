# Contract: プロフィール補完スキーマ（yup）

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

`service-front/src/features/auth/schemas/profile-completion.schema.ts`（新規）の契約。`001-auth` の `signup.schema.ts` から **メール / パスワード項目を除いた** プロフィール項目を再利用する。クライアント（React Hook Form）とサーバ（`completeProfile`）の両方で同一スキーマを使う。

## バリデーションルール（DB CHECK 制約・`001-auth` と一致）

| フィールド | ルール | エラーメッセージ（例） |
|------------|--------|------------------------|
| `lastName` | 必須・トリム後 1 文字以上・50 文字以内 | 「姓を入力してください」/「姓は 50 文字以内で入力してください」 |
| `firstName` | 必須・トリム後 1 文字以上・50 文字以内 | 「名を入力してください」 |
| `lastNameRomaji` | 必須・半角英字のみ（`/^[A-Za-z]+$/`）・50 文字以内 | 「姓（ローマ字）は半角英字で入力してください」 |
| `firstNameRomaji` | 必須・半角英字のみ・50 文字以内 | 「名（ローマ字）は半角英字で入力してください」 |
| `nickname` | 必須・トリム後 1 文字以上・50 文字以内 | 「ニックネームを入力してください」 |
| `birthOn` | 必須・`>= 1900-01-01`・未来日付不可（`<= 今日`） | 「正しい生年月日を入力してください」 |
| `gender` | `male` / `female` / `unanswered` のいずれか・必須（既定 `unanswered`） | 「性別を選択してください」 |
| `heightCm` | 任意・数値・`0 < x <= 300`・空は `null` | 「身長は 0〜300cm で入力してください」 |
| `weightKg` | 任意・数値・`0 < x <= 500`・空は `null` | 「体重は 0〜500kg で入力してください」 |

## 設計メモ

- `signup.schema.ts` の共通フィールド定義を切り出して両スキーマで共有することを推奨（重複を避ける。`readable-code.md`「無関係の下位問題を抽出」）。
- `gender` の値・ラベルは `@/shared/constants/gender`（`GENDER_VALUES` / `GENDER_OPTIONS` / `DEFAULT_GENDER`）を使う。
- パスワードはこのスキーマに **含めない**（OAuth ユーザーは Supabase 側でパスワードを持たない）。
- 型 `CompleteProfileInput` は `yup.InferType<typeof profileCompletionSchema>` から導出し、`completeProfile` の引数型に合わせる。

## テスト観点（Vitest）

- 各必須フィールドの未入力で reject される。
- ローマ字フィールドに全角・記号が入ると reject される。
- `birthOn` の未来日付・1900-01-01 未満が reject される。
- `gender` が 3 値以外で reject される。
- `heightCm` / `weightKg` の空文字が `null` に正規化される / 範囲外で reject される。
- 全項目正常で `validateSync` が通る。
