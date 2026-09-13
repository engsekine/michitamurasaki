# Data Model: デプロイパイプライン（028）

**アプリケーションの DB スキーマ変更はなし**（マイグレーション・テーブル・RLS の追加なし）。本機能のモデルは「環境と資格情報の構成」であり、以下はその対応表を正とする。

## 環境モデル

```text
ブランチ          GitHub Environment            Vercel（各アプリ）        Supabase
develop  ──────▶  staging                ──▶   Preview + stg 固定 alias   stg プロジェクト
main     ──────▶  production-approval（承認）
                  └─▶ production         ──▶   Production                prod プロジェクト
```

| 環境 | トリガー | Vercel 環境 | Supabase プロジェクト | 承認 |
|------|---------|------------|----------------------|:---:|
| staging | push to `develop` | Preview（固定エイリアス URL） | stg 用（新規作成） | なし |
| production | push to `main` | Production | prod 用（新規作成） | ✓ 1 回（`production-approval`） |

ローカル開発（`supabase start`）は本機能の対象外で影響を受けない。

## GitHub Environments

| Environment | required reviewers | 保持するシークレット | 参照元 |
|-------------|:---:|---------------------|--------|
| `staging` | なし | stg 用一式（下表） | `_deploy.yml`（environment=staging 時） |
| `production-approval` | **✓** | なし | `deploy-prod.yml` のゲートジョブのみ |
| `production` | なし | prod 用一式（下表） | `_deploy.yml`（environment=production 時） |

## シークレット（GitHub 側）

`staging` / `production` の両 Environment に**同名で**設定する（reusable workflow は環境名だけ切り替えて同じキー名を参照する）。

| シークレット名 | 用途 | 取得元 |
|---------------|------|--------|
| `VERCEL_TOKEN` | Vercel CLI の認証 | Vercel ダッシュボード > Account Settings > Tokens |
| `VERCEL_ORG_ID` | 対象チーム / アカウントの識別 | 各アプリで `vercel link` 後の `.vercel/project.json` |
| `VERCEL_PROJECT_ID_SERVICE_FRONT` | service-front の Vercel プロジェクト識別 | 同上（service-front で link） |
| `VERCEL_PROJECT_ID_ADMIN_FRONT` | admin-front の Vercel プロジェクト識別 | 同上（admin-front で link） |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI の認証（link / db push） | Supabase ダッシュボード > Account > Access Tokens |
| `SUPABASE_PROJECT_REF` | 対象 Supabase プロジェクトの参照 ID | 各プロジェクトの Settings > General（stg / prod で異なる値） |
| `SUPABASE_DB_PASSWORD` | `db push` の DB 接続 | プロジェクト作成時に設定した DB パスワード |
| `STG_ALIAS_SERVICE_FRONT` / `STG_ALIAS_ADMIN_FRONT` | stg 固定 URL（staging のみ設定） | 任意に決めるドメイン（例: `stg-<app>.vercel.app`） |

## アプリの環境変数（Vercel 側・`vercel pull` が取得）

各 Vercel プロジェクトの Environment Variables に、**Preview（= stg）/ Production（= prod）スコープで別値**を設定する。GitHub には置かない（FR-015 の分離は Vercel のスコープ機構で担保）。

| 変数 | service-front | admin-front | 備考 |
|------|:---:|:---:|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | stg / prod の Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | 同・anon（Publishable）key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | service-front は Stripe webhook の枠付与（026）。admin-front は管理操作。**Preview スコープには stg の値**を設定 |
| `NEXT_PUBLIC_SITE_URL` | ✓ | - | service-front の公開 URL（認証リダイレクト・Checkout の戻り先） |
| `NEXT_PUBLIC_ADMIN_SITE_URL` | - | ✓ | admin-front の公開 URL |
| `STRIPE_SECRET_KEY` | ✓ | - | stg = テストモード / prod = 本番モードのキー（FR-015） |
| `STRIPE_WEBHOOK_SECRET` | ✓ | - | 各環境の webhook エンドポイント登録時に発行される値 |
| `RESEND_API_KEY` ほかメール系 | ✓ | - | 実送信を行う環境のみ |

> 完全なリストは実装時に `service-front/.env.example` / `admin-front/.env.example` を正として転記する（contracts/secrets-and-envs.md）。

## 状態遷移（デプロイ実行）

```text
queued（concurrency 待ち）
  → migrate 実行 ──失敗──▶ failed（アプリ未反映 / FR-004）
  → migrate 成功
  → deploy-service-front / deploy-admin-front 並列実行
      ──いずれか失敗──▶ partially-failed（該当ジョブのみ再実行可 / FR-011。DB は適用済みで冪等）
  → 完了（GitHub 上に コミット・実行者・結果が記録 / FR-010）

production のみ: queued の前に approval（却下 → rejected・prod 無変更）
```
