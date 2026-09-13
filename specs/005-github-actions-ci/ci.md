# CI（GitHub Actions）

仕様: [specs/005-github-actions-ci/](spec.md)

## ワークフロー一覧

| ワークフロー | トリガー | 内容 | 所要時間目安 |
|---|---|---|---|
| [`ci.yml`](../../.github/workflows/ci.yml) | PR 作成・更新 / main push | 軽量チェック 5 ジョブ（並列） | 3〜8 分 |
| [`full-test.yml`](../../.github/workflows/full-test.yml) | main push のみ | E2E / a11y（Supabase 起動 + シード込み）+ Storybook テスト | 10〜20 分 |

### ci.yml のジョブ（= required checks 名）

| ジョブ名 | 実行コマンド |
|---|---|
| `lint` | `npm run check --workspace service-front`（biome lint + format 検査） |
| `markup-lint` | `npm run lint:markup --workspace service-front`（markuplint） |
| `type-check` | `npm run type-check --workspace service-front`（tsc） |
| `unit-test` | `npm run test:coverage --workspace service-front`（Vitest unit + カバレッジ閾値 70%） |
| `db-lint` | `supabase db start` → `supabase db lint`（マイグレーションの RLS / search_path 検査） |

- 同一 PR への連続 push は古い実行が自動キャンセルされる（main は完走）
- **シークレットは未使用**。E2E も Supabase CLI のローカルスタック（公開デフォルトキー）で完結するため、フォークからの PR でも全チェックが動く
- **Supabase CLI はバージョン固定（2.107.0）**。`version: latest` は GitHub API レート制限で失敗するため。更新時は ci.yml の `version` を手動で上げる

## branch protection の設定（手動・初回のみ）

メンテナが GitHub UI で設定する:

1. リポジトリの **Settings → Branches →（main の）Branch protection rule** を作成 / 編集
2. **Require status checks to pass before merging** を有効化
3. required checks に以下の 8 つを追加: `lint` / `markup-lint` / `type-check` / `unit-test` / `db-lint` / `lint-admin` / `type-check-admin` / `unit-test-admin`
4. （推奨）**Require branches to be up to date before merging** も有効化

> `full-test.yml` のジョブ（`e2e` / `storybook-test`）は main push 後に走るため required checks には**含めない**。

## 失敗時の調査

- PR の **Checks** タブ → 失敗ジョブ → ログで該当ステップを確認（ローカルの同名コマンドで再現可能）
- 失敗ジョブのみ再実行: GitHub UI の **Re-run failed jobs** または `gh run rerun <run-id> --failed`
- `full-test.yml` の E2E 失敗時は **Artifacts** の `playwright-report`（7 日保持）をダウンロードして trace / スクリーンショットを確認

## ローカルでの事前確認

CI と同じコマンドはローカルでそのまま実行できる:

```bash
npm run check --workspace service-front
npm run lint:markup --workspace service-front
npm run type-check --workspace service-front
npm run test:coverage --workspace service-front
npx supabase db lint

# ワークフロー YAML の静的検証
docker run --rm -v "$(pwd):/repo" --workdir /repo rhysd/actionlint:latest -color
```
