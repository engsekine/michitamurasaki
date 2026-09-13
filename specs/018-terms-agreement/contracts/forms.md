# Contract: フォーム & スキーマ（利用規約同意）

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

## `FormCheckbox`（新規・汎用）

`service-front/src/shared/components/form/FormCheckbox/` に新設し、`form/index.ts` で再エクスポート。

### Props
| Prop | 型 | 説明 |
|------|----|------|
| `id` | `string` | input と label の関連付け |
| `label` | `React.ReactNode` | ラベル内容（リンクを含められる） |
| `error` | `string \| undefined` | エラーメッセージ |
| `required` | `boolean` | 必須表示（`*` + sr-only「必須」）と `aria-required` |
| `checked` / `onChange` / `ref` / `name` 等 | `ComponentPropsWithRef<'input'>` を継承（RHF `register` のスプレッド対応） | react-hook-form と接続 |

### a11y 契約
- `<input type="checkbox" id={id}>` と `<label htmlFor={id}>` を関連付け
- エラー時に `aria-invalid="true"`、エラーは `role="alert"` で表示し `aria-describedby` で input に結ぶ
- 必須は `aria-required="true"`
- キーボード（Space）で切替可能（ネイティブ input のため自動）

## スキーマの追加フィールド

表記ゆれ防止のため共有フィールド `agreedToTermsField` を `service-front/src/shared/schemas/fields.ts` に定義し、`signup.schema.ts` / `profile-completion.schema.ts` の両方から `agreedToTerms: agreedToTermsField` として取り込む（DRY）:

```ts
// shared/schemas/fields.ts
export const agreedToTermsField = yup
    .boolean()
    .oneOf([true], '利用規約に同意してください')
    .required('利用規約に同意してください');
```

- 型は `agreedToTerms: boolean`（`true` のみ許容）
- 未チェック（false）はバリデーションエラー → 送信させない（FR-002 / FR-004）

## `TermsAgreementField`（同意フィールド本体）

`service-front/src/features/auth/components/client/TermsAgreementField/` に新設。`FormCheckbox` を内包し、利用規約をモーダル表示＋末尾スクロールで同意可能にする（FR-005 / FR-005b）。

- Props: `id: string` / `error?: string | undefined` + `ComponentPropsWithRef<'input'>` 継承（`register('agreedToTerms')` をスプレッド）
- 構成: 「利用規約を読む」トリガー（`@repo/ui` Dialog）→ モーダル内に規約全文（`@/features/terms` の `TermsContent` を再利用）→ スクロール領域の末尾到達を検知して同意チェックを有効化
- 末尾判定は純関数 `isScrolledToBottom({ scrollTop, clientHeight, scrollHeight }, threshold=8)`。スクロール不要な短さは到達済み扱い
- チェックボックスは「読了」まで `disabled`。`agreedToTerms` は `register` 経由で RHF に接続

## 規約本文の共有

`/terms` ページ（`TermsView`）と本モーダルは規約全文を `@/features/terms` の **`TermsContent`**（本文のみ・h1 やページ余白を含まない）で共有し、二重管理を防ぐ。`TermsView` は `<h1>利用規約</h1> + <TermsContent/>` で構成。

## フォームへの組み込み

| フォーム | 追加内容 |
|----------|----------|
| `SignupForm` | `<TermsAgreementField id="agreedToTerms" error={errors.agreedToTerms?.message} {...register('agreedToTerms')} />`。送信ハンドラは `agreedToTerms` を `signUp` に渡す（サーバー側ガード用） |
| `ProfileCompletionForm` | 同上。`completeProfile` 呼び出しに `agreedToTerms` を渡す |

### 受け入れ対応
FR-001〜FR-007（FR-005 / FR-005b 含む）、US1 / US2、SC-001 / SC-002 / SC-003 / SC-004

## テスト観点（Vitest）
- `FormCheckbox`: ラベル関連付け・チェック切替・エラー表示（`role="alert"` / `aria-invalid`）
- `isScrolledToBottom`: 末尾到達・しきい値・途中・短文（スクロール不要）の各判定
- `TermsAgreementField`: 初期はチェック無効・「利用規約を読む」でモーダル表示（条項見出し）・末尾到達後にチェック有効・error 表示
- 両スキーマ: `agreedToTerms` 未チェック（false/undefined）で reject、true で pass
- 両フォーム: 未チェック送信でエラー＆登録 Action 未呼び出し、規約モーダルを読了後にチェック→ Action 呼び出し
