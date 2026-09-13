# Contract: Server Actions & mappers（ダイバー種別/番号）

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

3 つの登録/更新経路に `diver_type` / `diver_number` を組み込む。値は常に「`diver_number` は `diver_type==='instructor'` のときのみ非 NULL」を満たすこと。

## `signUp(input)`（メール登録・`features/auth/server/actions.ts`）

| 項目 | 内容 |
|------|------|
| 入力追加 | `SignUpInput` に `diverType: DiverType` / `diverNumber: string \| null` |
| 記録 | `options.data` に `diver_type` と（instructor のときのみ）`diver_number` を渡す。トリガー `handle_new_user` がメール経路 INSERT で書く（data-model.md 変更2） |
| 既存挙動 | メール確認フロー・018 の terms 等は変更なし |

## `completeProfile(input)`（Google 初回・同 actions.ts）

| 項目 | 内容 |
|------|------|
| 入力追加 | `CompleteProfileInput` に `diverType` / `diverNumber` |
| 記録 | `toUserDetailsInsert` に `diver_type` と（instructor のときのみ）`diver_number` を追加 |

## `updateProfile(input)`（プロフィール編集・`features/account/server/actions.ts`）

| 項目 | 内容 |
|------|------|
| 入力追加 | `UpdateProfileInput` に `diverType: DiverType \| null` / `diverNumber: string \| null` |
| 取得 | `getProfile` の SELECT 列に `diver_type` / `diver_number` を追加し、編集画面へ初期値を返す |
| 更新 | `toUserDetailsUpdate` に `diver_type` を追加。`diver_number` は `diver_type==='instructor'` のときのみ値、そうでなければ `null`（一般ダイバーへ変更時に破棄＝FR-009 / CHECK ③） |

## mapper（`diver_number` の instructor 限定を一元化）

`toUserDetailsInsert` / `toUserDetailsUpdate` の双方で、保存する `diver_number` を次のロジックで決める:

```ts
diver_number: input.diverType === 'instructor' ? (input.diverNumber ?? null) : null
```

- これにより、UI/スキーマで漏れても mapper で最終整合を取り、DB CHECK ③違反を防ぐ。

## 定数
`DiverType` / `DIVER_TYPE_VALUES` は `@/shared/constants/diver-type` を参照。

## 受け入れ対応
FR-001〜FR-009、SC-001 / SC-002

## テスト観点（Vitest）
- `signUp`: `options.data` に `diver_type` を含む。instructor 時は `diver_number` も含む／general 時は含めない（or null）
- `completeProfile` / `toUserDetailsInsert`: instructor で番号保存、general で番号 null
- `updateProfile` / `toUserDetailsUpdate`: 種別を general に変更時に `diver_number` が null になる
- `getProfile`: `diver_type` / `diver_number` を返す
