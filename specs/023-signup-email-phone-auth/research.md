# Phase 0 Research: 認証強化（確認メール本番配信 + SMS 2 要素認証）

spec の Deferred 項目と Technical Context の未確定点を解決する。各項目は Decision / Rationale / Alternatives の形式で記録する。

## 1. 本番メール送信元（SMTP プロバイダ）

- **Decision**: Supabase Auth の `[auth.email.smtp]` を **Resend**（`smtp.resend.com:587`、user=`resend`、pass=`env(RESEND_API_KEY)`）で有効化する。`sender_name="ダイビングログ"` / `admin_email=env(CONTACT_MAIL_FROM)` を設定。※ 当初は SendGrid 案だったが、実装時のコード確認でプロジェクトが既に Resend を email プロバイダとして利用していると判明し、既存プロバイダへの統一を優先して変更（tasks.md T004 参照）。
- **Rationale**: 既存の問い合わせメール送信が Resend を利用しており、プロバイダ・API キー・ドメイン認証を一本化できる。Supabase 内蔵メールは本番非推奨・低レート（`max_frequency` 制約）で到達性が低いため、外部 SMTP が必須。
- **Alternatives considered**: SendGrid（config.toml に雛形コメントあり。当初案だったが既存 Resend 利用との重複を避け不採用）、Amazon SES（安価だが初期設定・サンドボックス解除が重い）。

## 2. メール到達性（送信者認証: SPF / DKIM / DMARC）

- **Decision**: 送信元ドメインに対し Resend のドメイン認証（SPF・DKIM レコード）を設定し、DMARC レコードを `p=none`（監視）から開始する。設定は本番 DNS の運用作業として quickstart に手順化し、コード変更はしない。
- **Rationale**: FR-007（送信元ドメインの正当性）と SC-001（99% 到達）を満たすには送信者認証が前提。迷惑メール振り分け（Edge Case）を最小化する。
- **Alternatives considered**: 認証なしの共有 IP 送信（到達性が低くバウンス/スパム率が悪化）→ 却下。

## 3. メールテンプレートの日本語化範囲

- **Decision**: サインアップ確認（confirmation）を日本語テンプレート（件名・本文・確認リンク・サービス名）として `supabase/templates/` に追加。パスワードリセット（recovery）・メール変更（email_change）は最低限日本語化するが、優先度はサインアップ確認 > その他。
- **Rationale**: Clarify Q2=A（全認証メールを配信対象、文面整備は確認メール中心）に一致。
- **Alternatives considered**: 全テンプレート完全カスタム（工数大）→ 段階的整備で足りる。

## 4. 確認メールの再送手段（FR-004）

- **Decision**: `supabase.auth.resend({ type: 'signup', email })` を呼ぶサーバーアクション `resendConfirmationEmail(email)` を追加し、サインアップ直後の「確認メールを送信しました」画面と `/login?error=email_not_verified` 画面に再送ボタンを置く。連続再送は `[auth.email] max_frequency` と UI 側のクールダウンで保護。
- **Rationale**: 既存 `signUp` は `emailRedirectTo=/api/auth/callback?next=/` を使用済みで、`resend` も同じ redirect 設定を踏襲できる。
- **Alternatives considered**: 独自トークン再発行 → Supabase 標準の resend で十分。

## 5. SMS プロバイダ（MFA phone）

- **Decision**: `[auth.sms.twilio]` を有効化（`account_sid` / `message_service_sid` を本番値、`auth_token=env(SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN)`）し、`[auth.mfa.phone]` の `enroll_enabled=true` / `verify_enabled=true` にする。`[auth.sms] enable_signup=false` は維持（電話番号でのサインアップはスコープ外）。
- **Rationale**: config.toml に Twilio 雛形が用意済み。MFA phone は Supabase Pro 前提（config.toml 明記）で、Twilio は Supabase がサポートするプロバイダ。Clarify で「MFA としてのみ・パスワードレスログインはスコープ外」を確定済み。
- **Alternatives considered**: MessageBird / Vonage（雛形はコメントのみ、Twilio が既定）、TOTP（アプリ認証。要件は「電話番号認証」なので phone/SMS を採用。TOTP は将来拡張）。

## 6. 有効化後のログイン 2 段階目（AAL1 → AAL2 の強制）

- **Decision**: ログイン 1 段階目成功後、`supabase.auth.mfa.getAuthenticatorAssuranceLevel()` が `currentLevel='aal1'` かつ `nextLevel='aal2'` の場合、保護ルート（`(authenticated)`）へ入れず 2 段階目チャレンジ画面（`/login/verify`）へ誘導する。ガードは `app/(authenticated)/layout.tsx` に**一元化**し、既存の email 未確認チェックと同じ場所に AAL チェックを追加する。※ 当初は proxy.ts（middleware）との二層案だったが、middleware でのリクエスト毎 AAL 取得コストとリダイレクトループ回避のため実装時に layout 一元化へ変更（proxy.ts には `/login/verify` が AUTH_ROUTES に含まれない旨の注記のみ）。チャレンジは `mfa.challenge({ factorId })` で SMS 送信 → `mfa.verify({ factorId, challengeId, code })` で昇格。
- **Rationale**: Supabase MFA はパスワード認証後に AAL1 セッションを張り、challenge/verify で AAL2 へ昇格するモデル。spec の「2 段階目未完了ではログイン未完了（保護コンテンツに入れない）」を、AAL2 未達なら保護ルートを遮断することで満たす。既存ガードに AAL 判定を足すだけで済み、変更範囲が小さい。
- **Alternatives considered**: RLS で AAL2 を要求（`(select auth.jwt()->>'aal')`）する DB 側強制 → 本フィーチャーは public 新規テーブルを持たないためルートガードで十分。将来 DB 側強制が必要になれば追加。

## 7. レート制限のしきい値

- **Decision**: メール = `[auth.email] max_frequency`（既定 `1s`）+ 再送 UI クールダウン（例: 60 秒）。SMS = `[auth.mfa.phone] max_frequency`（既定 `5s`）+ UI クールダウン、検証試行は Supabase の challenge 失効（コード有効期限）に委ねる。具体値は本番のコスト・UX を見て tasks/実装時に確定。
- **Rationale**: FR-005 / FR-013 を Supabase 標準のレート制限 + UI クールダウンで満たす。SMS はコストがかかるため過剰送信抑止が重要。
- **Alternatives considered**: 独自レート制限テーブル → 標準機能で足りるため不要。

## 8. admin-front からの MFA 要素解除（FR-016）

- **Decision**: admin-front に **サービスロールクライアント**（`admin-front/src/shared/lib/supabase/admin.ts`、`SUPABASE_SERVICE_ROLE_KEY`、`server-only`）を新設し、`requireAdmin()` ガード内のサーバーアクション `removeMfaFactor(userId)` からのみ使用する。`auth.admin.mfa.listFactors({ userId })` → `auth.admin.mfa.deleteFactor({ id, userId })` で全 phone 要素を削除し、`recordAudit` で「誰がどのユーザーの 2FA を解除したか」を記録する。UI はユーザー詳細ページ（`(admin)/users/[id]`）に確認付きボタンを追加。
- **Rationale**: MFA 要素の削除は Supabase Admin API（service_role 必須）でしか行えない。現状 admin-front は anon+RLS のみでサービスロールクライアントは未導入のため新設が必要。露出防止のため server-only + ガード内限定 + 監査必須。
- **Alternatives considered**: SECURITY DEFINER の Postgres 関数で `auth.mfa_factors` を直接削除 → auth スキーマ内部構造への直接依存は将来の Supabase 変更に脆く、challenge 等の整合も崩しうるため却下。Supabase ダッシュボード手動運用（Clarify で却下済み）。

## 9. service-front の MFA コードの配置

- **Decision**: MFA（enroll / challenge / verify / disable）関連は **新規 `service-front/src/features/mfa/`** に切り出す（server/actions.ts・schemas・components/client）。ログイン 2 段階目のチャレンジ UI も同機能に置き、`auth` 機能からログインフローが参照する。
- **Rationale**: `account`（プロフィール編集）とは関心が異なり、ログインフロー（`auth`）と設定画面の双方から使われる横断機能のため独立させると凝集度が上がる。Feature-based 規約に合致。
- **Alternatives considered**: `account` へ同居（プロフィールと混在し肥大化）、`auth` へ同居（設定画面依存が増える）→ 独立 `mfa` 機能が最もクリーン。

## 未解決（NEEDS CLARIFICATION 残なし）

Phase 0 で spec の Deferred はすべて設計判断として解決済み。実運用値（Resend/Twilio の本番アカウント発行、DNS への実レコード投入、しきい値の最終数値）は実装・運用作業として quickstart / tasks に委譲する。
