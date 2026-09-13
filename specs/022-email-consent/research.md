# Research: メール配信許可（オプトイン）

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

spec の Clarifications（Session 2026-06-29）で主要な不確実性は解消済み。本フィーチャーは 018-terms-agreement（利用規約同意）の「登録時チェック + `user_details` 記録」パターンをほぼ踏襲するため、技術的な NEEDS CLARIFICATION は残っていない。設計上の選択を以下に記録する。

## Decision 1: 同意の保持方式（カラム構成）

- **Decision**: `public.user_details` に `is_email_opted_in boolean not null default false` と `email_opted_in_at timestamptz`（nullable）の 2 列を追加し、CHECK 制約 `is_email_opted_in = (email_opted_in_at is not null)` で整合を担保する。
- **Rationale**: spec の Q2 回答（フラグ＋許可日時のみ保持・オフで日時クリア・CHECK で整合・履歴ログなし）に一致。018 の `terms_version` / `terms_agreed_at` + CHECK と同じ「2 列 + CHECK」パターンで、既存設計と一貫する。boolean カラムは `rules/sql.md` の `is_*` プレフィックス規則に従い `is_email_opted_in` とし、`is_published` / `published_at` と同じ「フラグ + `*_at`」の慣用ペアにする。
- **Alternatives considered**:
  - 単一 nullable `email_opted_in_at` のみ（NULL=不許可）: 列は減るが、UI トグルや RLS/集計で「許可フラグ」を直接参照したい場面が多く、boolean がある方が読みやすい。Q2 が明示的に「フラグ＋日時」を選んだため不採用。
  - 同意変更の時系列ログテーブル: 監査向きだが本アプリ規模では過剰。Q2 で不採用。

## Decision 2: 既存ユーザーの扱い（grandfather）

- **Decision**: 追加列は `is_email_opted_in` を `default false`、`email_opted_in_at` を NULL とし、既存行は一律「不許可」。
- **Rationale**: オプトインは明示同意が前提（FR-002 / FR-010）。過去登録に遡って同意を捏造しない。018 と同じ grandfather 方針。
- **Alternatives considered**: 既存ユーザーへの後追い同意依頼メール → spec で明確にスコープ外。

## Decision 3: チェックボックス UI（モーダル不要）

- **Decision**: 既存の汎用 `FormCheckbox`（018 で新設済み）を内包する薄いラッパー `EmailOptInField` を新設し、Signup / ProfileCompletion / ProfileEdit の 3 フォームで再利用する。利用規約のような全文モーダル・末尾スクロール判定は**設けない**。
- **Rationale**: メール配信許可は任意（オプトイン）で、必須同意の利用規約のように「全文を読ませてから同意」させる必要がない。ラッパーにラベル・補足文（FR-011: お知らせメール対象であり取引メールは対象外である旨）を集約し、文言の表記ゆれを防ぐ（018 の `agreedToTermsField` と同じ DRY 方針）。
- **Alternatives considered**: 各フォームで `FormCheckbox` を直接記述 → 文言が 3 箇所に分散し FR-011 の一貫性が崩れるため不採用。

## Decision 4: バリデーション（任意項目）

- **Decision**: 共有フィールド `emailOptInField = yup.boolean().default(false)` を `shared/schemas/fields.ts` に定義。`oneOf([true])` は付けない（任意のため未チェックでも通す、FR-003）。
- **Rationale**: 利用規約（必須 = `oneOf([true])`）と対照的に、メール配信は任意。デフォルト false でオプトインを担保（FR-002）。

## Decision 5: 設定画面での変更時の許可日時の扱い

- **Decision**: `updateProfile` では現在値を読み、OFF→ON の遷移時のみ `email_opted_in_at = now()` を新規記録する。ON→OFF では NULL にクリア。ON のまま再保存した場合は既存の `email_opted_in_at` を保持する。
- **Rationale**: spec の「許可済みになった**日時**」は最初に許可した時点を指す。再保存のたびに日時が更新されると意味がぶれるため保持する。撤回時のクリアは Q2 に一致。

## Decision 6: 記録経路（018 と同型）

- **Decision**: メール登録は `handle_new_user` トリガー、Google 初回は `completeProfile` の INSERT、登録後変更は `updateProfile` の UPDATE で記録する。`signUp` は `options.data.email_opt_in` にフォーム値を渡す。
- **Rationale**: 018 が確立した 3 経路に素直に追加でき、トリガーの `security definer set search_path = ''` も維持できる。
