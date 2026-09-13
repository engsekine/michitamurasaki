# Contract: 定数・スキーマ・フォーム（ダイバー種別/番号）

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

## 定数 `shared/constants/diver-type.ts`

`gender.ts` と同じ構成。

```ts
export const DIVER_TYPE_VALUES = ['instructor', 'general'] as const;
export type DiverType = (typeof DIVER_TYPE_VALUES)[number];
export const DIVER_TYPE_OPTIONS: ReadonlyArray<{ value: DiverType; label: string }> = [
    { value: 'instructor', label: 'インストラクター' },
    { value: 'general', label: '一般ダイバー' },
];
```
- 未選択値は持たない（登録は必須。既存ユーザーは DB 上 NULL）。DB CHECK の許容値と一致させる。

## ダイバーフィールド `shared/schemas/diver.ts`

種別の必須/任意で 2 つのフィールドセットを公開する（共通の `diverNumber` を共有）。`yup.object` へスプレッドして使う。
ファクトリ（`diverFields({ requireType })`）にしないのは、`requireType` の三項が `diverType` の InferType を nullable に広げ、必須経路のフォーム型と矛盾するため。

```ts
export const requiredDiverFields = { diverType, diverNumber }; // 登録: diverType 必須
export const optionalDiverFields = { diverType, diverNumber }; // 編集: diverType 任意
```

| フィールド | requiredDiverFields（登録） | optionalDiverFields（編集） |
|------------|---------------------------|----------------------------|
| `diverType` | `mixed<DiverType>().oneOf([...DIVER_TYPE_VALUES]).required('ダイバー種別を選択してください')` | `mixed<DiverType>().oneOf([...DIVER_TYPE_VALUES]).nullable().optional()`（未選択可） |
| `diverNumber` | （両者共通 `diverNumberField`）`string().trim().nullable().transform(''→null).max(50,'ダイバー番号は50文字以内で入力してください')` ＋ `.when('diverType', ([diverType], s) => diverType==='instructor' ? s : s.strip())` | 同左 |

**契約条件**:
- `diverType==='instructor'` 以外では `diverNumber` を送信値から除外（`strip`）。UI で隠すだけでなくスキーマでも破棄（DB CHECK ③と整合）
- `optionalDiverFields`（編集）は `diverType` 未選択での保存を許可し、既存ユーザーをブロックしない（FR-009）

### 各スキーマへの組み込み
| スキーマ | 追加 |
|----------|------|
| `auth/schemas/signup.schema.ts` | `...requiredDiverFields` |
| `auth/schemas/profile-completion.schema.ts` | `...requiredDiverFields` |
| `account/schemas/profile.schema.ts` | `...optionalDiverFields` |

## フォーム UI（条件付き表示）

各フォーム（`SignupForm` / `ProfileCompletionForm` / `account/ProfileEditForm`）に:
- `FormRadioGroup`（legend「ダイバー種別」、`DIVER_TYPE_OPTIONS`、`{...register('diverType')}`、`errors.diverType`）
- `watch('diverType') === 'instructor'` のときだけ `FormField`（id `diverNumber`、label「ダイバー番号」、`{...register('diverNumber')}`、`errors.diverNumber`）を表示

**契約条件（a11y / react.md）**:
- RHF オブジェクト（`register`/`control`/`formState`）を子コンポーネントへそのまま渡さない。各フォーム内で `watch` し条件描画する（共有コンポーネント化しない）
- `FormRadioGroup` は凡例・`role`・キーボード操作、`FormField` は label 関連付け・`aria-invalid`・エラー `role="alert"`

### 受け入れ対応
FR-001〜FR-009、US1 / US2、SC-001 / SC-002 / SC-004

## テスト観点（Vitest）
- `requiredDiverFields`: 種別未選択で reject、`instructor`+番号OK、`general`+番号 → 番号が破棄、番号 51 文字で reject
- `optionalDiverFields`: 種別未選択でも pass（編集の非ブロック）
- 各フォーム: 種別ラジオ表示、`instructor` 選択で番号欄出現／`general` で非表示、未選択送信でエラー（登録フォームのみ）
