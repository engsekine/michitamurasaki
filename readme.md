# claudeの最適設定を研究するリポジトリ

## セットアップ

### devcontainer で使う

以下のコマンドを実行すると、プロジェクトの `.devcontainer/devcontainer.json` にコピペできる `mounts` 設定が出力されます。

```bash
make devcontainer
```

出力された JSON を `.devcontainer/devcontainer.json` の `mounts` に追加してください。

> コンテナのユーザーが `root` 以外（例: `vscode`, `node`）の場合は `target` のパスを変更してください。
> 例: `target=/home/vscode/.claude/skills,...`

#### `devcontainer.json` の変更をgitに追わせない

`mounts` はホストのパスが含まれるため人によって異なります。チームでリポジトリを共有している場合は、ローカルの変更をgitに追跡させない設定が便利です。

```bash
git update-index --skip-worktree .devcontainer/devcontainer.json
```

これにより `devcontainer.json` への変更が `git diff` や `git status` に表示されなくなります。

解除する場合:

```bash
git update-index --no-skip-worktree .devcontainer/devcontainer.json
```

> **`.gitignore` との違い**: `skip-worktree` はすでにgit管理されているファイルのローカル変更を無視します。チームのベース設定はgitで共有しつつ、個人のmounts設定だけを追跡対象から外したい場合に使います。

#### 未追跡ファイルをローカルでだけ除外する（`.git/info/exclude`）

`.gitignore` をリポジトリにコミットしたくない場合や、自分だけのローカルルールを追加したい場合は `.git/info/exclude` に記述します。

```bash
# .git/info/exclude に追記
echo ".devcontainer/devcontainer.json" >> .git/info/exclude
```

`.gitignore` と同じ記法で書けますが、このファイル自体はgit管理されないためチームに影響しません。

| 方法 | 対象ファイルの状態 | チームへの影響 |
|------|-----------------|--------------|
| `.gitignore` | 未追跡ファイル | あり（gitで共有） |
| `.git/info/exclude` | 未追跡ファイル | なし（ローカルのみ） |
| `skip-worktree` | すでにgit管理されているファイル | なし（ローカルのみ） |

---

## Web サービス全体の環境構築

このリポジトリはダイビングログアプリのモノレポを兼ねています。**各サービスの詳細なセットアップ手順はそれぞれのディレクトリの README に集約**されており、ここでは全体像と起動順序だけをまとめます。

| ディレクトリ | 内容 | 起動ポート | セットアップ詳細 |
|-------------|------|-----------|----------------|
| `supabase/` | ローカル Supabase（Auth / PostgreSQL / Storage）の設定・マイグレーション・seed | 54321（API）/ 54322（DB）/ 54323（Studio） | [supabase/README.md](supabase/README.md) |
| `service-front/` | ユーザー向けアプリ（Next.js App Router）。Docker で起動 | 3000 | [service-front/README.md](service-front/README.md) |
| `admin-front/` | 運営管理画面（Next.js）。npm で直接起動 | 3001 | [admin-front/README.md](admin-front/README.md) |
| `mobile/` | モバイルアプリ（Expo / React Native）。**未完成（開発中）** | 8081（Expo dev server） | [mobile/README.md](mobile/README.md)（Expo 初期テンプレートのまま） |
| `packages/` | 共有パッケージ（`@repo/ui` / `@repo/supabase`） | - | - |

> **モバイルアプリは未完成です。** 現在はログイン・ログの一覧 / 作成・オフライン同期・エクスポート呼び出しの最小機能のみで、Web（service-front）と同等の機能や 2 要素認証（SMS）には対応していません。上記の起動順序・デプロイ手順は Web サービスを対象としています。

### 前提ツール

| ツール | 用途 | インストール（macOS） |
|--------|------|----------------------|
| Node.js 24 | ランタイム（`package.json` の volta 設定でピン留め） | `curl https://get.volta.sh \| bash` → 自動で 24 系が入る |
| Docker Desktop | Supabase スタック / service-front の起動 | [公式サイト](https://www.docker.com/products/docker-desktop/) |
| Supabase CLI | ローカル BaaS の起動・マイグレーション | `brew install supabase/tap/supabase` |
| mkcert | ローカル HTTPS 証明書 | `brew install mkcert` |
| Stripe CLI | ログ枠購入（026）の webhook 転送。**任意** | `brew install stripe/stripe-cli/stripe` |

### 起動順序（クイックスタート）

Supabase → service-front → admin-front の順に立ち上げます。

```bash
# 1. 依存パッケージ（ルートで 1 回。workspaces 全体に反映）
npm install

# 2. Supabase の起動と DB 構築
#    事前に supabase/.env と supabase/.env.local の作成が必要
#    → 詳細: supabase/README.md（環境変数 / 初期データ）
supabase start
make supabase-reset

# 3. service-front（ユーザー向けアプリ → http://localhost:3000）
#    事前に service-front/.env の作成が必要 → 詳細: service-front/README.md
make front-setup   # 初回のみ
make front-dev-https

# 4. admin-front（運営管理画面 → http://localhost:3001）
#    → 詳細: admin-front/README.md
make admin-cert    # 初回のみ
make admin-dev-https
```

- ログ枠購入（Stripe 決済）を動かす場合の設定・**テスト用カード番号**は [service-front/README.md の「Stripe の設定」](service-front/README.md#stripe-の設定ログ枠購入--026) を参照
- 各サービスの make コマンド一覧は `make help`（ルート / 各ディレクトリ）で確認できます

---

## ブランチ運用

機能ブランチ → `develop` → `main` の一方向に流し、`develop` が **stg**、`main` が **prod** に対応します。デプロイはブランチへのマージでは起動せず、対応するブランチを選んで Actions から手動実行します（詳細は次章）。

```text
<NNN>-<feature-name>（機能ブランチ）
   │  PR・レビュー・CI（push で自動実行）
   ▼
develop ──── Actions > Deploy (staging) ────▶ stg（Supabase stg / Vercel Preview 固定 URL）
   │  PR（develop → main）
   ▼
main ─────── Actions > Deploy (production) ─▶ prod（Supabase prod / Vercel Production・承認 1 回）
```

| ブランチ | 役割 | 直接 push | 派生元 | マージ先 | 対応環境 |
|---------|------|:---:|--------|---------|---------|
| `<NNN>-<feature-name>`（例: `037-forgotten-item-check`） | 機能・修正の作業ブランチ。spec-kit の `/speckit-specify` が `specs/<NNN>-<feature-name>/` と同名で作成する | ✓ | `develop` | `develop` | （ローカル） |
| `develop` | 統合ブランチ。stg で動作確認する内容 | ✗（PR 必須） | — | `main` | **stg** |
| `main` | リリース済みの内容。常に prod と一致させる | ✗（PR 必須） | — | — | **prod** |

### ルール

- 機能ブランチは **必ず `develop` から切る**。`main` から切らない（`develop` に未リリースの変更が溜まっている前提のため）
- `develop` / `main` への反映は **PR 経由のみ**。PR は `CI`（lint / type-check / unit test / db lint）が green であることを確認してからマージする
- `main` へは `develop` からの PR のみ流す。機能ブランチから `main` へ直接 PR を出さない（stg を経ずに prod へ出ることを防ぐ）
- hotfix が必要な場合も `develop` に入れて stg で確認したうえで `main` へ流す。緊急時に `main` へ直接入れた場合は、必ず `main` → `develop` へ逆マージして差分を戻す
- マージ後の機能ブランチは削除する（GitHub の "Automatically delete head branches" を有効化推奨）
- コミットメッセージは `feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:` の prefix を付ける（[.claude/CLAUDE.md](.claude/CLAUDE.md) のコミットメッセージ規約）

### 1 機能の流れ

```bash
# 1. develop を最新化して機能ブランチを切る
git switch develop && git pull
git switch -c 038-new-feature          # /speckit-specify を使う場合は自動で作成される

# 2. 実装・コミット・push → develop への PR を作成
git push -u origin 038-new-feature
gh pr create --base develop

# 3. レビュー・CI green → マージ → Actions > Deploy (staging) を develop で実行 → stg で確認

# 4. リリース: develop → main の PR を作成・マージ → Actions > Deploy (production) を main で実行 → 承認
gh pr create --base main --head develop --title "release: <日付 or 内容>"
```

stg 環境の初期セットアップ（Supabase / Vercel / GitHub Secrets）がまだの場合は [DEPLOY_STG.md](DEPLOY_STG.md) を参照してください。

---

## デプロイ（stg / prod）

GitHub Actions によるデプロイパイプライン（028-deploy-pipeline）。**手動実行（workflow_dispatch）** で、DB マイグレーション → アプリの順に反映されます（2026-07-17 にマージ連動の自動デプロイから移行）。

### 全体像

```text
Actions > Deploy (staging)    > Run workflow（develop を選択）: stg へ反映
Actions > Deploy (production) > Run workflow（main を選択）   : 承認者の承認 1 回 → prod へ反映

各デプロイの流れ（_deploy.yml）:
  migrate（supabase db push）──成功後──▶ service-front / admin-front を並列デプロイ（Vercel）
  ※ マイグレーションが失敗したらアプリは反映されない（新アプリ + 旧スキーマの不整合防止）
```

| 実行時に選ぶブランチ | 環境 | Vercel | Supabase | 承認 |
|---------|------|--------|----------|:---:|
| `develop` | stg | Preview デプロイ + 固定エイリアス URL | stg プロジェクト | なし |
| `main` | prod | Production | prod プロジェクト | ✓ 1 回 |

- ワークフロー: [`_deploy.yml`](.github/workflows/_deploy.yml)（実体・reusable）/ [`deploy-stg.yml`](.github/workflows/deploy-stg.yml) / [`deploy-prod.yml`](.github/workflows/deploy-prod.yml)
- デプロイ元ブランチはワークフロー内のガードで固定（stg = develop / prod = main）。他のブランチを選んで実行してもジョブはスキップされます
- `CI` はブランチへの push で自動実行されます（2026-08-08 に手動運用から復帰）。`Full Test`（E2E / Storybook）は手動実行のままです。デプロイ前に対象ブランチで CI が通っていることを確認してから実行してください（required checks は設定していない）
- 同一環境への連続実行は直列化されます（実行中デプロイは完走・後続はキュー待ち）

### 必要なシークレット（GitHub Environments）

GitHub リポジトリの **Settings > Environments** に 3 つの環境を作成します。

| Environment | required reviewers | 用途 |
|-------------|:---:|------|
| `staging` | なし | stg 用シークレット（deployment branch: `develop`） |
| `production-approval` | **✓ 1 名以上** | prod 承認ゲート専用（シークレットは置かない・branch: `main`） |
| `production` | なし | prod 用シークレット（branch: `main`） |

シークレットは以下を設定します（値は環境ごとに別）:

| シークレット名 | 用途 | 取得元 | 設定場所 |
|---------------|------|--------|---------|
| `VERCEL_TOKEN` | Vercel CLI 認証 | Vercel > Account Settings > Tokens | `staging` / `production` 両方 |
| `VERCEL_ORG_ID` | チーム識別 | 各アプリで `npx vercel link` 後の `.vercel/project.json` の `orgId` | 同上 |
| `VERCEL_PROJECT_ID_SERVICE_FRONT` | service-front の識別 | 同 `projectId`（service-front で link） | 同上 |
| `VERCEL_PROJECT_ID_ADMIN_FRONT` | admin-front の識別 | 同 `projectId`（admin-front で link） | 同上 |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI 認証 | Supabase > Account > Access Tokens | 同上 |
| `SUPABASE_PROJECT_REF` | 反映先プロジェクト | 各プロジェクト Settings > General > Reference ID（stg / prod で別値） | 同上 |
| `SUPABASE_DB_PASSWORD` | `db push` の接続 | プロジェクト作成時の DB パスワード（stg / prod で別値） | 同上 |
| `STG_ALIAS_SERVICE_FRONT` / `STG_ALIAS_ADMIN_FRONT` | stg 固定 URL | 任意のドメイン | **`staging` のみ** |

アプリの環境変数（Supabase URL / Stripe キー等）は GitHub ではなく **Vercel の Environment Variables**（Preview = stg / Production = prod のスコープ別）に設定します。変数の一覧は [specs/028-deploy-pipeline/contracts/secrets-and-envs.md](specs/028-deploy-pipeline/contracts/secrets-and-envs.md) を参照してください。

### 初期セットアップ（一度だけ）

1. **Supabase**: stg / prod の 2 プロジェクトを作成し、Reference ID・DB パスワード・API キーを控える。Auth の Site URL / Redirect URLs に各環境の URL を登録（`supabase config push` は使わない・手動運用）
2. **Vercel**: service-front / admin-front の 2 プロジェクトを作成。Root Directory をそれぞれ `service-front` / `admin-front` に設定し、**Git 連携の自動デプロイを無効化**（有効のままだと push で二重デプロイされ順序保証が壊れる）。Environment Variables を Preview / Production スコープで設定
3. **Stripe**: テストモード（stg URL）/ 本番モード（prod URL）それぞれに webhook エンドポイント `https://<env-url>/api/stripe/webhook` を登録し、`whsec_...` を Vercel の該当スコープへ
4. **GitHub Environments**: 上記 3 環境を作成し、シークレットと required reviewers を設定
5. **ブランチ保護**: develop / main に PR 必須を設定（required checks は任意。`CI` は push で自動実行されるため設定しても良いが、手動実行の `Full Test` を required にするとマージ不能になるので含めない）

### リリースの流れ

1. 機能ブランチ → `develop` へ PR・マージ → push で自動実行される `CI`（必要なら `Full Test` を手動実行）が develop で green であることを確認
2. Actions の `Deploy (staging)` を **develop を選んで Run workflow** → stg URL で動作確認
3. `develop` → `main` へ PR・マージ → Actions の `Deploy (production)` を **main を選んで Run workflow** → **承認待ちで停止**
4. 承認者が Actions の Review deployments から承認 → DB → アプリの順で prod へ反映

### トラブルシューティング

| 症状 | 対処 |
|------|------|
| migrate が失敗した | アプリは未反映のまま止まる（正常な安全動作）。マイグレーションを修正する場合は**逆方向の新規マイグレーション**を追加してマージし、デプロイを再実行（down は書かない / sql.md） |
| アプリのデプロイだけ失敗した | Actions の「Re-run failed jobs」で該当ジョブのみ再実行（`db push` は適用済みをスキップするため再実行しても安全） |
| 手動で再デプロイしたい | 対象ワークフローの実行履歴から「Re-run all jobs」（コードの再ビルド + 再デプロイ。DB は no-op） |
| 承認依頼が来ない | Environment `production-approval` の required reviewers 設定を確認 |
| デプロイ URL を知りたい | 各ジョブの Summary に出力される |

---

