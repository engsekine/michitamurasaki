# Contract: フォーム & スキーマ（メール配信許可）

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

## 再利用する汎用コンポーネント

`FormCheckbox`（`service-front/src/shared/components/form/FormCheckbox/`、018 で新設済み）をそのまま再利用する。新規作成は不要。a11y 契約（label 関連付け・`aria-invalid`・`role="alert"`・`aria-required`・Space 切替）は 018 の contract に準拠。

## スキーマの追加フィールド

表記ゆれ防止のため共有フィールド `emailOptInField` を `service-front/src/shared/schemas/fields.ts` に定義し、3 スキーマから `emailOptIn: emailOptInField` として取り込む（DRY）:

```ts
// shared/schemas/fields.ts
export const emailOptInField = yup.boolean().default(false);
```

- 型は `emailOptIn: boolean`。**任意項目**のため `oneOf([true])` は付けない（未チェック=false でも通す、FR-003）。
- デフォルト `false` でオプトインを担保（FR-002）。
- 取り込み先: `signup.schema.ts` / `profile-completion.schema.ts` / `account/schemas/profile.schema.ts`。

## `EmailOptInField`（同意フィールド本体・新規）

`service-front/src/shared/components/form/EmailOptInField/` に新設し、`form/index.ts` で再エクスポートする。`FormCheckbox` を内包し、配信許可チェックの**ラベルと補足文を 1 箇所に集約**する。利用規約のようなモーダル・末尾スクロール判定は持たない（任意のオプトインのため）。

- Props: `id: string` / `error?: string | undefined` + `ComponentPropsWithRef<'input'>` 継承（`register('emailOptIn')` をスプレッド）
- ラベル: 「お知らせメールを受け取る」相当（任意であることを明示）
- 補足文（FR-011）: 「点検期限のお知らせなど、サービスからの任意のお知らせメールを受け取ります。登録確認やパスワード再設定など手続き上必要なメールは、この設定に関わらず送信されます。」を `aria-describedby` で関連付け
- 既定は未チェック（`defaultValues` で false）

> auth（登録）と account（設定画面）の両方から使う横断 UI のため `shared/components/form/` に配置し、feature→feature 依存を避ける（`FormCheckbox` のみに依存）。各フォームからは `@/shared/components/form` の barrel 経由で import する。

## フォームへの組み込み

| フォーム | 追加内容 |
|----------|----------|
| `SignupForm` | `<EmailOptInField id="emailOptIn" error={errors.emailOptIn?.message} {...register('emailOptIn')} />`。送信ハンドラは `emailOptIn` を `signUp` に渡す |
| `ProfileCompletionForm` | 同上。`completeProfile` 呼び出しに `emailOptIn` を渡す |
| `ProfileEditForm`（設定画面） | 同上。`defaultValues.emailOptIn` に現在値を渡し、`updateProfile` 呼び出しに `emailOptIn` を含める（US2 / FR-006 / FR-007） |

### 受け入れ対応
FR-001 / FR-002 / FR-003 / FR-006 / FR-007 / FR-011、US1 / US2、SC-001 / SC-003 / SC-004

## テスト観点（Vitest）
- `emailOptInField`: 未指定で `false`、`true`/`false` どちらも pass（必須エラーにならない）
- `EmailOptInField`: ラベル・補足文の表示、初期未チェック、チェック切替、`aria-describedby` 関連付け、error 表示（`role="alert"`）
- 各フォーム: 未チェックで送信 → Action に `emailOptIn=false` が渡る / チェックで送信 → `emailOptIn=true`
- `ProfileEditForm`: `defaultValues.emailOptIn=true` で初期チェック済み表示
