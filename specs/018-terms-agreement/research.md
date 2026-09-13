# Research: 新規登録時の利用規約同意

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

メール登録（`001-auth`）と Google 初回ログイン（`016-google-login`）の両経路で利用規約同意を必須にし、同意日時・規約バージョンを記録するための設計判断。

---

## Decision 1: 同意記録の保存先 = `user_details` に列追加（専用テーブルにしない）

- **Decision**: `public.user_details` に `terms_version text`（nullable）と `terms_agreed_at timestamptz`（nullable）を追加する。CHECK 制約で「両方 NULL または両方 NOT NULL」を保証。
- **Rationale**: 両サインアップ経路は既に `user_details` 行を作る（メール=`handle_new_user` トリガー、Google=`completeProfile` の INSERT）。同テーブルに 2 列足すのが最小変更で、書き込み経路を増やさない。spec で再同意（規約改定時の再取得）は対象外のため、履歴を持つ専用テーブルは過剰。既存ユーザーは両列 NULL（feature 以前の登録＝grandfather）。
- **Alternatives considered**:
  - 専用テーブル `user_terms_agreements`（user_id, version, agreed_at の履歴）→ 再同意・複数バージョン履歴が必要になったら有効だが、現状はオーバーエンジニアリング。将来再同意要件が出たら移行する。
  - `users` テーブルに持たせる → プロフィール属性は `user_details` に集約する既存方針に反する。

---

## Decision 2: 規約バージョンの表現

- **Decision**: 現行の規約バージョンを定数 `CURRENT_TERMS_VERSION`（`service-front/src/shared/constants/terms.ts`）で管理し、登録時にその値を保存する。形式は規約改定日に合わせた `YYYY-MM-DD`（例 `'2026-06-26'`）。
- **Rationale**: 「どの版に同意したか」を後から監査できる。日付形式は規約ページの改定日と対応づけやすい。アプリが保存値を渡すため DB は文字列として保持するだけでよい。
- **Alternatives considered**: semver（`1.0.0`）→ 規約は日付管理が一般的で運用が簡単なため日付を採用。DB の enum 化 → 版が増えるたび ALTER が要るため不可。

---

## Decision 3: メール経路の記録 = `handle_new_user` トリガー経由

- **Decision**: `signUp` の `options.data` に `terms_version` を追加し、`handle_new_user()`（016 で分岐済み）を再定義してメール経路（`raw_user_meta_data ? 'nickname'`）の `user_details` INSERT に `terms_version`（meta から）と `terms_agreed_at = now()` を含める。`security definer set search_path = ''` は維持。
- **Rationale**: 016 と同じパターン。メールサインアップのプロフィールはトリガーが meta から書くため、同意情報も同じ経路で一貫して書ける。`agreed_at` は DB の `now()`（サーバー権威）。
- **Alternatives considered**: アプリから別途 UPDATE → トリガー INSERT 後の追加往復が無駄で競合の余地。トリガーに集約する。

---

## Decision 4: Google 経路の記録 = `completeProfile` の INSERT に含める

- **Decision**: `completeProfile` が `agreedToTerms` を受け取り、INSERT ペイロード（mapper）に `terms_version = CURRENT_TERMS_VERSION` と `terms_agreed_at`（登録時刻）を含める。
- **Rationale**: Google 経路は `completeProfile` がアプリから `user_details` を INSERT する（016）。同じ INSERT に同意情報を載せるのが自然。
- **Alternatives considered**: トリガーで Google も書く → OAuth 初回は user_details を作らない設計（016 Decision 2）なので不可。

---

## Decision 5: サーバー側ガード（FR-008）

- **Decision**: `signUp` / `completeProfile` の双方で、`agreedToTerms !== true` の場合は処理を実行せず `actionFailure`（同意が必要な旨）を返す。クライアントの yup スキーマ＋チェックボックス無効化に加える二重防御。
- **Rationale**: クライアント無効化だけに依存しない（FR-008）。フォーム改ざん・直接呼び出しでも未同意登録を防ぐ。
- **Alternatives considered**: DB の NOT NULL 制約だけで担保 → 既存ユーザーを grandfather するため列は nullable。よってアプリ層のガードが必要。

---

## Decision 6: 同意チェックボックスの UI = 汎用 `FormCheckbox` を新設

- **Decision**: `service-front/src/shared/components/form/FormCheckbox/` を新設（`input[type="checkbox"]` + label 関連付け + `aria-invalid` + エラーの `role="alert"`）。ラベルは ReactNode を受け取り、`/terms` へのリンクを含む文言を渡せるようにする。`SignupForm` と `ProfileCompletionForm` の両方で再利用する。
- **Rationale**: 既存 form コンポーネント（FormField / FormRadioGroup / FormSelect / FormTextarea）にチェックボックスが無い。2 フォームで使うため汎用化が妥当。アクセシビリティ（憲章 V）を 1 箇所で担保。
- **Alternatives considered**: features/auth 専用コンポーネント → 汎用 checkbox は他機能でも使える可能性が高く shared が適切。素の `<input>` を各フォームに直書き → a11y/エラー表示が散らばるため不可。

---

## Decision 7: 規約リンクと入力保持

- **Decision**: チェックボックス文言内の「利用規約」リンクは既存 `/terms` を指す。SPA 内のためフォーム状態は保持される。新規タブ（`target="_blank" rel="noopener"`）で開けば確実に入力が残る。
- **Rationale**: FR-005（リンクを開いても入力を失わない）。
- **Alternatives considered**: モーダルで規約全文表示 → スコープ拡大。既存ページ参照で十分。

---

## 未解決事項

なし（spec の `[NEEDS CLARIFICATION]` は specify で解消済み）。`CURRENT_TERMS_VERSION` の初期値は実装時に確定（既定 `'2026-06-26'`）。
