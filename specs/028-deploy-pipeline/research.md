# Research: デプロイパイプライン（028）

技術判断の記録。Decision / Rationale / Alternatives considered の形式。

## 1. ワークフローの分割方針（ユーザー指示: 別ワークフロー）

**Decision**: 既存 `ci.yml` / `full-test.yml` は一切変更せず、新規 3 ファイルを追加する。実体は reusable workflow `_deploy.yml`（`workflow_call`、inputs: `environment`）とし、`deploy-stg.yml` / `deploy-prod.yml` はトリガー + 環境指定 + （prod のみ）承認ゲートだけを持つ薄いラッパーにする。

**Rationale**:

- ユーザー指示（別ワークフローで対応）に合致し、CI の required checks 名（branch protection が参照）を壊さない
- stg / prod のロジック差分は「環境名・承認の有無」だけなので、重複を reusable workflow で排除すると修正が 1 箇所で済む
- `_` プレフィックスは「直接トリガーされない内部部品」の慣習的な目印

**Alternatives considered**: ci.yml へのジョブ追加（指示に反する・CI とデプロイのライフサイクルが混ざる）、stg / prod 独立 2 ファイルにロジック重複（同期漏れリスク）、composite action 化（ジョブ間依存・environment 指定が表現できず不採用）。

## 2. Vercel へのデプロイ方式

**Decision**: Vercel の Git 連携（自動デプロイ）は**両プロジェクトで無効化**し、Actions から Vercel CLI で `vercel pull --environment=<preview|production>` → `vercel build` → `vercel deploy --prebuilt` を実行する。stg は Preview デプロイ後に `vercel alias set` で固定 stg URL を張り、prod は `--prod` で反映する。

**Rationale**:

- Git 連携はプッシュと同時に無条件でビルドが走るため、「DB マイグレーション成功後にのみアプリを反映」（FR-004）と「prod は承認後にのみ反映」（FR-006）が表現できない
- `--prebuilt` は Actions 上でビルドしてから成果物をアップロードする方式で、ビルド失敗時に Vercel 側へ何も反映されない（安全側）
- 環境変数は `vercel pull` が Vercel プロジェクトの Preview / Production スコープから取得するため、アプリの環境変数管理は Vercel ダッシュボードに一元化できる（FR-015 の stg / prod 分離は Vercel のスコープ機構で担保）

**Alternatives considered**:

- **Vercel Git 連携（自動）**: 順序制御・承認ゲート不可のため不採用（上記）
- **Deploy Hooks（URL を叩く）**: 順序は制御できるがビルドは Vercel 側で非同期実行され、完了・成否をパイプラインが追跡しにくい（FR-010 の追跡性に欠ける）
- **Vercel プロジェクトを stg / prod で分ける**: clarify で「同一プロジェクト + Preview/Production」を選択済み

## 3. prod の承認ゲート（承認 1 回 / SC-002）

**Decision**: GitHub Environments を 2 つ使い分ける。

| Environment | required reviewers | シークレット | 使うジョブ |
|-------------|:---:|:---:|-----------|
| `production-approval` | ✓ | なし | `deploy-prod.yml` の先頭ゲートジョブ（何もしない approve ジョブ） |
| `production` | なし | prod 用一式 | `_deploy.yml` 内の migrate / deploy ジョブ |

**Rationale**: required reviewers は「その Environment を参照するジョブが開始されるたび」に承認を要求する。DB → アプリの直列ジョブ全部に `production` の reviewers を付けると承認が 2 回以上必要になり SC-002（承認操作 1 回）に反する。承認だけを空の Environment に分離すれば、ゲートジョブ 1 つの承認で後続全体が解放され、シークレットは reviewers なしの `production` でスコープされる。シークレットに触れるワークフローは push トリガー（main）でしか動かないため、承認なし Environment でも第三者がシークレットに到達する経路はない。

**Alternatives considered**: 全ジョブを 1 ジョブに統合（並列性を失う・ジョブ単位の再実行（FR-011）が粗くなる）、`workflow_dispatch` の手動実行（マージ → 反映の自動性を失う）、承認 2 回を許容（SC-002 違反）。

## 4. テスト成功の前提（FR-007）

**Decision**: develop / main へのブランチ保護（PR 必須 + 既存 CI ジョブを required checks に指定）で担保する。デプロイワークフロー内ではテストを再実行しない。

**Rationale**: マージされたコミットは PR 上で既存 CI（lint / type-check / test 群）を通過済み。デプロイ側での再実行は 15 分制約（SC-001）を圧迫し、二重実行のコストに見合う検出力向上がない。ブランチ保護の設定は GitHub 上の操作なので quickstart / README の初期セットアップ手順に含める。

**Alternatives considered**: `workflow_run`（CI 完了後にトリガー）— 既存 ci.yml は develop push で走らないためトリガー連鎖が成立せず、ci.yml の変更（= 指示違反）が必要になる。デプロイ内でのテスト再実行 — 上記のとおり不採用。

## 5. マイグレーションの適用方式

**Decision**: `supabase link --project-ref <ref>`（アクセストークンは env）→ `supabase db push` を migrate ジョブで実行する。`supabase config push` は行わない。

**Rationale**:

- `db push` はリモートのマイグレーション履歴テーブルと突合し、未適用分だけを順に適用する（FR-005 の冪等性・再実行安全性がツール標準で担保される）
- `config.toml` にはローカル開発向けの設定（Mailpit 前提の SMTP_ENABLED 分岐・ローカル用ポート等）が含まれ、そのまま push すると本番 Auth 設定を壊しうる。Auth 設定・URL 許可リスト等の本番反映は手動運用とし README に明記する

**Alternatives considered**: `supabase migration up --db-url`（DB 直結文字列の取り回しがシークレット漏えいに弱い。link + アクセストークン方式が公式推奨）、Vercel の Supabase 統合（マイグレーション適用機能はない）。

## 6. 直列化・追い越し防止（FR-009）

**Decision**: 呼び出し側ワークフローに `concurrency: { group: deploy-<env>, cancel-in-progress: false }` を設定する。

**Rationale**: `cancel-in-progress: false` により実行中デプロイは完走し、後続はキューで待つ（デプロイ途中キャンセルによる中途半端な状態を避ける）。同一グループのキューは最新のみ保持されるため、連続マージ時は「実行中 1 + 最新の待機 1」に収束し、古いコミットが新しいコミットを上書きする追い越しは起きない。

**Alternatives considered**: `cancel-in-progress: true`（DB 適用後・アプリ反映前のキャンセルで不整合が残るリスク）、直列化なし（追い越しで古いビルドが最終状態になる事故を許してしまう）。

## 7. README の配置

**Decision**: ルート readme に「デプロイ」章を新設する（ユーザー要望どおり）。シークレット表・手順の原本は spec の contracts / quickstart に置き、README はそこから転記した利用者向けの完成形とする。各サービス README からはルートのデプロイ章へリンクを張る。

**Rationale**: デプロイは 3 サービス横断 + GitHub 設定の関心事で、既存方針（サービス固有の詳細は各 README）のどれか 1 つに寄せられない。ルート readme は既に「全体像 + 起動順序」の入口なので、デプロイの入口もそこに置くのが一貫する。

**Alternatives considered**: `docs/deployment.md` に分離（README 直記載というユーザー要望に反する）、各サービス README に分散（シークレットの全体像・順序制御が分断され SC-005 の 1 時間セットアップに不利）。
