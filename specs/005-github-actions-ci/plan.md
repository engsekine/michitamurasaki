# Implementation Plan: CI/CD 整備（GitHub Actions）

**Branch**: `005-github-actions-ci` | **Date**: 2026-06-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-github-actions-ci/spec.md`

## Summary

GitHub Actions に 2 本のワークフローを追加する。**`ci.yml`** は PR と main push で軽量チェック（biome check / markuplint / 型 / 単体テスト + カバレッジ / DB lint）を並列ジョブで実行し、**`full-test.yml`** は main push のみで重いテスト（Supabase 起動 + Playwright E2E・a11y + Storybook テスト）を実行する。シークレットは使わず（ローカル Supabase の公開キーのみ）、フォーク PR でも全チェックが動作する。

## Technical Context

**Language/Version**: GitHub Actions YAML / Node.js 22（`actions/setup-node`）/ Ubuntu ランナー（`ubuntu-latest`）

**Primary Dependencies**: `actions/checkout` / `actions/setup-node`（npm キャッシュ内蔵）/ `supabase/setup-cli`（DB lint・E2E 用）/ Playwright（ブラウザは CI 上で `npx playwright install chromium --with-deps`）

**Storage**: なし（CI はステートレス。E2E 用 DB は実行ごとに Supabase CLI で起動・破棄）

**Testing**: 既存の npm scripts をそのまま実行（`check` / `lint:markup` / `type-check` / `test:coverage` / `test:e2e` / `test:storybook`）。新しい検査は追加しない

**Target Platform**: GitHub Actions（GitHub ホストランナー）

**Project Type**: npm workspaces モノレポ（ルート `package-lock.json`、対象 workspace は `service-front` と `admin-front`。admin-front も CI 対象（`lint-admin` / `type-check-admin` / `unit-test-admin` ジョブ。2026-07-02 追加））

**Performance Goals**: PR の軽量チェックは並列実行 + npm キャッシュで **10 分以内**（SC-001）。連続 push は `concurrency` で旧実行をキャンセル（FR-003 / SC-004）

**Constraints**: シークレット不要（FR-008。Supabase ローカルキーは公開された開発用デフォルト値）/ ワークフローはリポジトリ管理（FR-010）

**Scale/Scope**: ワークフロー 2 ファイル + ジョブ 6 種 + ドキュメント（branch protection 手順）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` v1.0.0 に照らして確認（UI を持たない infra feature のため該当原則のみ）:

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. Spec-Driven | ✅ | spec.md 確定済み（checklists 全項目パス） |
| III. Test-First | ✅（適用形を変更） | 本 feature の成果物は「テストを実行する仕組み」。ワークフロー自体の検証は quickstart.md の実 PR 検証で行う |
| IV. Security | ✅ | シークレット不使用・フォーク PR 安全（FR-008）。サードパーティ Action はメジャーバージョン固定 |
| V. Accessibility | ✅ | full-test.yml が既存 a11y テスト（axe）を自動実行する側 |
| VI. Coding Standards | ✅ | 既存スクリプトの実行のみ。規約の変更なし |

II（Server Components First）は対象外。**違反なし。**

**Post-Design 再評価（Phase 1 完了後）**: 違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/005-github-actions-ci/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0: 設計判断
├── quickstart.md        # 検証手順（実 PR での動作確認）
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks で生成
```

data-model.md / contracts/ は対象外（DB エンティティ・外部公開 API を持たないため）。required checks のジョブ名一覧は本ファイルの「ジョブ構成」が契約に相当する。

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── ci.yml           # PR + main push: 軽量チェック（並列 5 ジョブ）
    └── full-test.yml    # main push のみ: E2E / a11y / Storybook テスト

specs/005-github-actions-ci/
└── ci.md                # branch protection（required checks）の手動設定手順
```

## ジョブ構成

### `ci.yml`（trigger: `pull_request` + `push: branches: [main]`）

`concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: <main 以外 true> }`（FR-003）

| ジョブ名（= required check 名） | 実行内容 | 備考 |
|---|---|---|
| `lint` | `npm run check --workspace service-front` | biome（lint + format 検査。FR-004 の「スタイル / フォーマット」） |
| `markup-lint` | `npm run lint:markup --workspace service-front` | markuplint |
| `type-check` | `npm run type-check --workspace service-front` | tsc |
| `unit-test` | `npm run test:coverage --workspace service-front` | Vitest unit + カバレッジ閾値 70% 検証（FR-004） |
| `db-lint` | `supabase db start` → `supabase db lint` | supabase/setup-cli。DB コンテナのみ起動（FR-005） |

- 各ジョブは独立（FR-004 / FR-006 / FR-009: 個別ステータス・個別再実行）
- 共通セットアップ: `actions/checkout` → `actions/setup-node`（`node-version: 22` / `cache: 'npm'`）→ `npm ci`（FR-007）

### `full-test.yml`（trigger: `push: branches: [main]` のみ。FR-011）

| ジョブ名 | 実行内容 |
|---|---|
| `e2e` | `supabase start`（フルスタック）→ `supabase db reset`（マイグレーション + シードユーザー投入）→ `.env` 生成（ローカルキー）→ `npx playwright install chromium --with-deps` → `npm run test:e2e --workspace service-front`（webServer は playwright.config が `.next-playwright` で起動） |
| `storybook-test` | `npx playwright install chromium --with-deps` → `npm run test:storybook --workspace service-front`（Vitest browser mode。DB 不要） |

- 環境変数: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`、anon key は `supabase status -o env` の出力から取得（**シークレット不要** — ローカル開発用の公開デフォルトキー）
- 失敗時は `playwright-report` を artifact としてアップロード（原因調査用）

## 設計詳細

### シークレットレス構成（FR-008）

E2E も CI ランナー内の Supabase ローカルスタックで完結するため、リポジトリシークレットを一切登録しない。フォーク PR でも `ci.yml` の全ジョブが実行できる（`full-test.yml` は main push のみなのでフォーク問題自体が発生しない）。

GitHub Actions の permissions は `contents: read` に最小化（2026-07-02）。

### Action のバージョン方針

サードパーティ Action はメジャーバージョンタグで固定（`actions/checkout@v4` / `actions/setup-node@v4` / `supabase/setup-cli@v1`）。SHA ピン留めは運用コストが上回るため Phase 1 では行わない（research.md Decision 5）。

Supabase CLI はバージョン固定（2.107.0）。`version: latest` は GitHub API レート制限で失敗するため。更新時は ci.yml の `version` を手動で上げる。

### branch protection（Assumption の手動設定）

`specs/005-github-actions-ci/ci.md` に以下の手順を記載する: Settings → Branches → main に required status checks（`lint` / `markup-lint` / `type-check` / `unit-test` / `db-lint`）を設定。リポジトリ設定は GitHub UI での手動作業（API 権限・課金プランに依存するため自動化しない）。

### ローカルとの一致（SC-003）

CI は既存 npm scripts を**そのまま**呼ぶ（オプション追加や独自コマンドを作らない）。これによりローカル `npm run validate` 相当と CI の結果が一致する。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

違反なし（記載事項なし）。
