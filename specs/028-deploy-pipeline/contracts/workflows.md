# Contract: ワークフロー（028）

3 ファイルの責務・トリガー・ジョブグラフの契約。既存 `ci.yml` / `full-test.yml` は変更しない。

## deploy-stg.yml

```yaml
name: Deploy (staging)
on:
  push:
    branches: [develop]
concurrency:
  group: deploy-staging
  cancel-in-progress: false   # 実行中は完走・後続はキュー（FR-009）
permissions:
  contents: read
jobs:
  deploy:
    uses: ./.github/workflows/_deploy.yml
    with:
      environment: staging
    secrets: inherit
```

## deploy-prod.yml

```yaml
name: Deploy (production)
on:
  push:
    branches: [main]
concurrency:
  group: deploy-production
  cancel-in-progress: false
permissions:
  contents: read
jobs:
  approve:
    # 承認だけを担う空ジョブ。production-approval の required reviewers が
    # ここで 1 回だけ承認を要求する（research 3 / SC-002）
    runs-on: ubuntu-latest
    environment: production-approval
    steps:
      - run: echo "approved"
  deploy:
    needs: approve
    uses: ./.github/workflows/_deploy.yml
    with:
      environment: production
    secrets: inherit
```

## _deploy.yml（reusable / workflow_call）

- **inputs**: `environment`（string・必須。`staging` | `production`）
- **secrets**: `inherit`（呼び出し側の Environment シークレットを引き継ぐ）

### ジョブグラフ

```text
migrate ──▶ deploy-service-front
        └─▶ deploy-admin-front     （2 つは並列）
```

| ジョブ | environment | 内容 |
|--------|-------------|------|
| migrate | `${{ inputs.environment }}` | supabase/setup-cli → `supabase link --project-ref $SUPABASE_PROJECT_REF` → `supabase db push`（`SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` を env で注入） |
| deploy-service-front | 同上 | `needs: migrate`。checkout → setup-node → `npx vercel pull --yes --environment=<preview|production>` → `npx vercel build [--prod]` → `npx vercel deploy --prebuilt [--prod]` → staging のみ `npx vercel alias set <deploy-url> $STG_ALIAS_SERVICE_FRONT` |
| deploy-admin-front | 同上 | 同型（PROJECT_ID / alias が admin 用） |

- Vercel の環境切替: `inputs.environment == 'production'` のとき `--environment=production` + `--prod`、staging のとき `--environment=preview`（環境変数は Vercel の該当スコープから取得 / FR-015）
- `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID_*` は env 経由で CLI に渡す（`vercel link` 済みディレクトリ不要の非対話実行）
- モノレポ対応: 各 deploy ジョブは Vercel プロジェクト側の Root Directory 設定（service-front / admin-front）に従う

### 失敗時の挙動（契約）

| 失敗点 | 結果 |
|--------|------|
| migrate 失敗 | 両アプリのジョブは実行されない（`needs` / FR-004）。DB は失敗したマイグレーションの手前まで適用（Postgres のトランザクション単位でロールバック） |
| アプリ片方の失敗 | もう片方は継続。失敗ジョブのみ「Re-run failed jobs」で再実行可（FR-011。migrate は再実行されても `db push` が no-op で安全 / FR-005） |
| 承認却下（prod） | approve ジョブが失敗し、以降のジョブはすべてスキップ。prod は無変更 |

### 追跡性（FR-010）

- 実行はコミット SHA に紐づき、Environments の Deployment 履歴（対象・実行者・結果）が GitHub 上に残る
- 各 deploy ジョブは最後にデプロイ先 URL をジョブサマリー（`$GITHUB_STEP_SUMMARY`）へ出力する

## 前提条件（ワークフロー外の設定・quickstart で実施）

- develop / main のブランチ保護: PR 必須 + 既存 CI ジョブ（lint / type-check / test 等）を required checks に設定（FR-007）
- GitHub Environments 3 つの作成とシークレット設定（contracts/secrets-and-envs.md）
- Vercel 2 プロジェクトの Git 連携（自動デプロイ）を無効化（research 2。有効なままだと push で二重デプロイされ順序保証が壊れる）
