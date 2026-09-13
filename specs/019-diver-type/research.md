# Research: ダイバー種別・ダイバー番号の登録

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

`user_details` にプロフィール属性を 2 つ追加し、登録 2 経路（メール / Google 初回）＋プロフィール編集に組み込む。016/018 と同じ構造に乗せつつ、「登録時のみ必須・編集では任意」「番号はインストラクターのみ」という条件を破綻なく満たすための設計判断。

---

## Decision 1: `user_details` に列追加（gender と同じ text + CHECK 方式）

- **Decision**: `diver_type text`（null可、CHECK で `in ('instructor','general')`）と `diver_number text`（null可、長さ・条件 CHECK）を追加。enum 型は使わず `text + CHECK`（`sql.md` 準拠・ALTER 容易）。
- **Rationale**: 既存の `gender`（`male/female/unanswered`）と同じパターンで一貫。新規テーブル不要。既存ユーザーは両列 NULL で grandfather。
- **Alternatives considered**: PostgreSQL `enum` 型 → 値追加に ALTER TYPE が要り運用が硬いため不採用（`sql.md` も非推奨）。専用テーブル → 1:1 属性なので過剰。

---

## Decision 2: 「番号はインストラクターのみ」を DB CHECK で担保

- **Decision**: 次の CHECK を付ける。
  - `diver_type` は null または `in ('instructor','general')`
  - `diver_number` は null または `char_length(trim(diver_number)) between 1 and 50`
  - **`diver_number is null or diver_type = 'instructor'`**（一般ダイバー/未設定で番号が残らない）
- **Rationale**: spec の「一般ダイバーでは番号を保存しない／種別を一般に戻したら破棄」をデータ層で保証。アプリのバグや別経路の書き込みでも不整合を防ぐ。
- **Alternatives considered**: アプリ層のみで担保 → 整合が崩れる余地。CHECK で二重化する。

---

## Decision 3: 必須差を「フィールドファクトリ」で吸収（userProfileFields には足さない）

- **問題**: 共有 `userProfileFields` は signup / profile-completion / **account（プロフィール編集）** の 3 スキーマで使われる。`diver_type` は登録では必須・編集では任意（FR-009 / Q1）。共有オブジェクトに必須で足すと、既存ユーザーが編集保存時にブロックされる。
- **Decision**: `shared/schemas/diver.ts` に 2 つのフィールドセット `requiredDiverFields` / `optionalDiverFields` を作り、共通の `diverNumberField` を共有する（いずれも `{ diverType, diverNumber }`）。
  - `requiredDiverFields`（signup / profile-completion）→ `diverType` は `oneOf(['instructor','general']).required()`
  - `optionalDiverFields`（account 編集）→ `diverType` は `nullable().optional()`
  - `diverNumberField`（両者共通）: `string().trim().transform(''→null).max(50).nullable()` ＋ **`.when('diverType', { is:'instructor', then: 維持, otherwise: strip })`**
- **Rationale**: 必須差をフィールドセットの分割で表現し、条件付き（番号=instructor のみ）は yup `.when` で同一オブジェクト内参照。`userProfileFields` の既存利用を壊さない。
- **Alternatives considered**: `diverFields({ requireType })` ファクトリ → `requireType` 三項が `diverType` の InferType を nullable に広げ、必須経路のフォーム型と矛盾したため不採用（実装で 2 オブジェクトに分割）。`userProfileFields` に必須で追加 → 編集で既存ユーザーをブロック（FR-009 違反）。

---

## Decision 4: 条件付きの番号欄 UI は各フォームで `watch` してインライン描画

- **Decision**: `diver_type` は `FormRadioGroup`、`diver_number` は `diver_type === 'instructor'` のときだけ `FormField` を表示する。各フォーム（SignupForm / ProfileCompletionForm / ProfileEditForm）で `watch('diverType')` を見て条件描画する。
- **Rationale**: `react.md`「`register`/`control`/`formState` を子へそのまま渡さない」に従い、共有コンポーネントに RHF オブジェクトを渡す設計を避ける。既存フォームも各フィールドを `{...register()}` でインライン構成しており一貫。
- **Alternatives considered**: 共有 `DiverTypeFields` に `control`/`register` を渡す → `react.md` 違反。`FormProvider` 導入 → 既存フォーム全体のリファクタになり過剰。
- **Note**: 一般ダイバー選択時に番号が残らないよう、yup `.when` で送信値を null 化（UI で隠すだけでなく値も破棄）。

---

## Decision 5: 記録経路（016/018 と同一パターン）

- **メール登録**: `signUp` の `options.data` に `diver_type` / `diver_number` を渡し、`handle_new_user` トリガー（016/018 で分岐済み）のメール経路 INSERT に追記。
- **Google 初回**: `completeProfile` の INSERT（`toUserDetailsInsert`）に追加。
- **プロフィール編集**: `updateProfile` の UPDATE（`toUserDetailsUpdate`）に追加。`UpdateProfileInput` に 2 フィールド追加。
- **Rationale**: 既存の記録経路にそのまま乗せる。新経路を増やさない。
- **Note**: トリガーは `security definer set search_path = ''` を維持。`diver_number` は `diver_type='instructor'` のときのみ値を入れる（CHECK 整合）。

---

## Decision 6: enum 値・ラベル定数

- **Decision**: `shared/constants/diver-type.ts` に `DIVER_TYPE_VALUES = ['instructor','general'] as const`、`DIVER_TYPE_OPTIONS`（`instructor`→「インストラクター」/ `general`→「一般ダイバー」）、`type DiverType` を定義。gender 定数と同じ構成。未選択値（`unanswered` 相当）は持たない（登録は必須・既存は NULL）。
- **Rationale**: DB CHECK とアプリ enum を一致させる（`gender` と同方針）。ラジオ描画は `DIVER_TYPE_OPTIONS` を再利用。

---

## 未解決事項

なし（spec の `[NEEDS CLARIFICATION]` は specify / clarify で解消済み）。`diver_number` の上限は 50 文字（spec 確定）。
