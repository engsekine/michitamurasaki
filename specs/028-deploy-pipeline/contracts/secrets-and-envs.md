# Contract: シークレットと環境変数（028）

README のシークレット一覧表（FR-013）の原本。環境モデルの全体像は [data-model.md](../data-model.md) を参照。

## GitHub Environments の定義

| Environment | required reviewers | deployment branch 制限 | 用途 |
|-------------|:---:|------|------|
| `staging` | なし | `develop` のみ | stg 用シークレットの保管・スコープ |
| `production-approval` | **✓（1 名以上）** | `main` のみ | prod 反映の承認ゲート（シークレットは置かない） |
| `production` | なし | `main` のみ | prod 用シークレットの保管・スコープ |

## GitHub シークレット一覧（staging / production 両 Environment に同名で設定）

| 名前 | 用途 | 取得元 | 設定場所 |
|------|------|--------|---------|
| `VERCEL_TOKEN` | Vercel CLI 認証 | Vercel > Account Settings > Tokens で発行 | 両 Environment |
| `VERCEL_ORG_ID` | チーム識別 | ローカルで `npx vercel link` 後の `.vercel/project.json` の `orgId` | 両 Environment |
| `VERCEL_PROJECT_ID_SERVICE_FRONT` | service-front プロジェクト識別 | 同 `projectId`（service-front を link） | 両 Environment |
| `VERCEL_PROJECT_ID_ADMIN_FRONT` | admin-front プロジェクト識別 | 同 `projectId`（admin-front を link） | 両 Environment |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI 認証 | Supabase > Account > Access Tokens で発行 | 両 Environment |
| `SUPABASE_PROJECT_REF` | 反映先プロジェクト | 各プロジェクト Settings > General > Reference ID（**stg / prod で別値**） | 両 Environment |
| `SUPABASE_DB_PASSWORD` | `db push` の接続 | プロジェクト作成時の DB パスワード（**stg / prod で別値**） | 両 Environment |
| `STG_ALIAS_SERVICE_FRONT` | stg 固定 URL | 任意（例: `stg-diving-log.vercel.app`） | staging のみ |
| `STG_ALIAS_ADMIN_FRONT` | stg 固定 URL | 任意（例: `stg-diving-log-admin.vercel.app`） | staging のみ |
| `RESEND_API_KEY` | `supabase config push` が `config.toml` の `env(...)` を解決するため（認証メール SMTP） | Resend の API キー | 両 Environment |
| `CONTACT_MAIL_FROM` | 同上（認証メールの送信元） | Resend で検証済みドメインのアドレス | 両 Environment |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | 同上（Google ログイン） | Google Cloud Console の OAuth 2.0 クライアント | 両 Environment（Google ログインを使う場合） |
| `SUPABASE_AUTH_SMS_TWILIO_ACCOUNT_SID` / `_MESSAGE_SERVICE_SID` / `_AUTH_TOKEN` | 同上（SMS 2 要素認証） | Twilio Console | 両 Environment（SMS 2FA を使う場合） |

> `supabase config push` 用の変数はローカルの `supabase/.env` と同名。CI には `.env` が無いため Environment secrets からワークフローの `env:` で注入する（`SMTP_ENABLED` はワークフロー内で `'true'` 固定）。

> リポジトリレベル（Repository secrets）には置かない。Environment スコープに置くことで、stg のワークフロー実行から prod の資格情報へ到達できないことを構造で保証する（FR-008 / FR-015）。

## Vercel 環境変数（各プロジェクトの Environment Variables）

Preview スコープ = stg、Production スコープ = prod として**別値**を設定する。`vercel pull` がビルド時に取得するため GitHub 側には置かない。

### service-front プロジェクト

| 変数 | Preview（stg）の値 | Production（prod）の値 |
|------|-------------------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | stg Supabase の Project URL | prod Supabase の Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | stg の anon / Publishable key | prod の同 key |
| `SUPABASE_SERVICE_ROLE_KEY` | stg の service_role key | prod の同 key（026 webhook 用） |
| `NEXT_PUBLIC_SITE_URL` | stg 固定 URL | 本番 URL |
| `STRIPE_SECRET_KEY` | **テストモード** `sk_test_...` | **本番モード** `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | stg エンドポイント登録時の `whsec_...` | prod 同（下記） |
| メール送信系（`RESEND_API_KEY` 等） | stg 用（または未設定） | 本番用 |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | stg 閲覧用の ID / パスワード（任意。両方揃うと `src/proxy.ts` が Basic 認証を要求。`/api/stripe/webhook` は免除） | **未設定**（設定すると本番全体が閉じる） |

> 実装時に `service-front/.env.example` の全変数と突合し、漏れがないことを確認する（tasks で検証タスク化）。

### admin-front プロジェクト

| 変数 | Preview（stg） | Production（prod） |
|------|---------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | stg の値 | prod の値 |
| `SUPABASE_SERVICE_ROLE_KEY` | stg の service_role key | prod の同 key |
| `NEXT_PUBLIC_ADMIN_SITE_URL` | stg 固定 URL | 本番 URL |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | stg 閲覧用の ID / パスワード（任意。両方揃うと `src/proxy.ts` が Basic 認証を要求） | **未設定**（設定すると本番全体が閉じる） |

## 外部サービス側の付随設定（初期セットアップに含める）

| サービス | 設定 | 備考 |
|---------|------|------|
| Vercel（両プロジェクト） | Git 連携の自動デプロイを**無効化**、Root Directory を `service-front` / `admin-front` に設定 | 有効なままだと push で二重デプロイ（research 2） |
| Supabase（stg / prod） | Auth / API / Storage 設定は `supabase/config.toml`（共通ベース）+ `supabase/config.staging.toml` / `config.production.toml`（`[remotes.<env>.*]` の環境差分）で管理し、`migrate` ジョブが `supabase/scripts/build-remote-config.sh` で結合して `supabase config push` で反映する | Dashboard での手入力はしない（ファイルが正）。Reference ID は差分ファイルの `project_id` にコミットする |
| Supabase Dashboard（stg / prod） | Storage バケット `dive-photos` の作成、初回 superadmin の登録 | `config push` の反映対象外のため手動 |
| Stripe | stg（テストモード）/ prod（本番モード）それぞれに webhook エンドポイント `https://<env-url>/api/stripe/webhook` を登録し、`checkout.session.completed` / `checkout.session.expired` / `checkout.session.async_payment_failed` / `charge.refunded` を購読 | 発行された `whsec_...` を Vercel 環境変数へ |
| GitHub | develop / main のブランチ保護（PR 必須 + CI required checks） | FR-007 の前提 |
