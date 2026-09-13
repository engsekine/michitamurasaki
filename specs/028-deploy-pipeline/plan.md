# Implementation Plan: デプロイパイプライン（GitHub Actions による stg / prod 自動反映）

**Branch**: `028-deploy-pipeline` | **Date**: 2026-07-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/028-deploy-pipeline/spec.md`

## Summary

既存 CI（`ci.yml` / `full-test.yml`）には手を入れず、**デプロイ専用の別ワークフロー**を新設する（ユーザー指示）。共通のデプロイロジックを reusable workflow `_deploy.yml`（`workflow_call`）に集約し、`deploy-stg.yml`（on: push develop）と `deploy-prod.yml`（on: push main）が環境名だけを変えて呼び出す薄いトリガーにする。ジョブ構成は **DB マイグレーション（`supabase db push`）→ 成功後に service-front / admin-front を並列デプロイ**の直列 2 段（FR-004）。Vercel へは Git 連携ではなく **Vercel CLI（`vercel pull` → `build` → `deploy --prebuilt`）** を使い、Actions からデプロイ順序を完全制御する。stg は Preview デプロイ + 固定エイリアス、prod は `--prod`。prod の承認ゲート（FR-006 / 承認 1 回）は **approval 専用の GitHub Environment（`production-approval`・required reviewers）を最初のゲートジョブに置き、後続ジョブは秘密情報用の `production` Environment を参照**する 2 環境方式で「承認は 1 回・秘密は環境スコープ」を両立する。テスト前提（FR-007）はブランチ保護の required checks（既存 CI のジョブ）で担保する。README にはデプロイ章（全体像・シークレット一覧表・初期セットアップ・トラブルシューティング）を追加する（US3）。

## Technical Context

**Language/Version**: GitHub Actions（YAML）/ Bash。アプリコードの変更なし

**Primary Dependencies**: Vercel CLI（`npx vercel`）、Supabase CLI（`supabase/setup-cli` action）、actions/checkout・setup-node。新規 npm 依存なし

**Storage**: なし（DB スキーマ変更なし）。デプロイ対象として stg / prod の Supabase プロジェクト 2 つを新規作成（外部サービス側の手作業・README に手順化）

**Testing**: ワークフローの静的検証（`actionlint`）+ quickstart の実マージ検証（develop へのダミーマージ → stg 反映確認）。ワークフロー自体の単体テストは書かない（憲法 III の対象外レイヤ）

**Target Platform**: GitHub Actions（ubuntu-latest）→ Vercel（アプリ 2 つ）+ Supabase（マイグレーション）

**Project Type**: CI/CD インフラ（`.github/workflows/` + README ドキュメント）

**Performance Goals**: マージ → stg 反映 15 分以内（SC-001。ビルド 2 本並列で通常 5〜8 分想定）

**Constraints**: 既存 `ci.yml` / `full-test.yml` は変更しない（別ワークフロー指示）。DB → アプリの順序厳守・DB 失敗時はアプリ反映中止（FR-004）。同一環境への実行は concurrency で直列化・キャンセルしない（FR-009）。シークレットはコードに含めない（FR-008 / SC-003）。fork PR からシークレット参照不可（push トリガーのみで担保）

**Scale/Scope**: 新規ワークフロー 3 ファイル（`_deploy.yml` / `deploy-stg.yml` / `deploy-prod.yml`）、GitHub Environments 3 つ（`staging` / `production-approval` / `production`）、README のデプロイ章、Vercel プロジェクト 2 つ + Supabase プロジェクト 2 つの外部セットアップ手順。対象外: 自動ロールバック、Slack 通知、Vercel / Supabase の IaC 化、`supabase config push`（Auth 設定等の同期は手動運用）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 準拠状況 |
|------|---------|
| I. Spec-Driven Development | spec（clarify 2 件回答済み）→ plan の順で確定。違反なし |
| II. Server Components First | アプリコード変更なしのため対象外 |
| III. Test-First | アプリコードのテスト対象なし。ワークフローは actionlint による静的検証 + quickstart の実環境検証で代替 |
| IV. Security & RLS by Default | スキーマ変更なし。シークレットは GitHub Environments で環境分離し、Actions 標準のマスキングを利用。GITHUB_TOKEN は read 権限に固定（既存 ci.yml と同方針）。prod DB パスワード等は `production` Environment のみに置き、stg ワークフローから参照不可。違反なし |
| V. Accessibility | UI 変更なしのため対象外 |
| VI. Coding Standards | YAML は既存 ci.yml の記法（コメント・permissions 最小化・concurrency 命名）に揃える。README は既存の集約方針（入口はルート・詳細リンク）に従う。違反なし |

**判定**: 違反なし。Complexity Tracking 記載不要。

## Project Structure

### Documentation (this feature)

```text
specs/028-deploy-pipeline/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0: デプロイ方式・承認ゲート・テスト前提の設計判断
├── data-model.md        # Phase 1: 環境・シークレットの構成モデル（DB スキーマ変更なしの明示）
├── quickstart.md        # Phase 1: 初期セットアップ + stg / prod 反映の検証手順
├── contracts/
│   ├── workflows.md        # 3 ワークフローのトリガー・ジョブ・入出力契約
│   └── secrets-and-envs.md # GitHub Environments / シークレット / Vercel 環境変数の契約
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks 出力（本コマンドでは未生成）
```

### Source Code (repository root)

```text
.github/workflows/
├── ci.yml                  # 既存（変更しない）
├── full-test.yml           # 既存（変更しない）
├── _deploy.yml             # ★新規: reusable workflow（inputs: environment。DB→アプリ反映の実体）
├── deploy-stg.yml          # ★新規: on push develop → _deploy.yml を environment=staging で呼ぶ
└── deploy-prod.yml         # ★新規: on push main → 承認ゲートジョブ → _deploy.yml を environment=production で呼ぶ

readme.md                   # ★変更: 「デプロイ」章を追加（全体像・シークレット表・初期セットアップ・トラブルシューティング）
```

**Structure Decision**: デプロイは「別ワークフロー」というユーザー指示に従い、既存 CI と完全分離した 3 ファイル構成にする。stg / prod の差分（トリガーブランチ・環境名・承認の有無）以外のロジック重複を避けるため、実体は reusable workflow `_deploy.yml` に一本化。`_` プレフィックスで「直接トリガーされない内部ワークフロー」であることを示す。README は「入口はルート・詳細は各サービス」の既存方針に対し、デプロイは 3 サービス横断の関心事のため**ルート readme に章を新設**する（各サービス README からは参照リンク）。

## Phase 0: Research

主要な設計判断は [research.md](research.md) に集約する。要点:

1. **Vercel へのデプロイ方式: CLI（pull → build → deploy --prebuilt）** — Git 連携の自動デプロイでは DB → アプリの順序制御（FR-004）と承認ゲート（FR-006）が実現できないため、Git 連携は無効化し Actions から CLI で制御する。
2. **stg の表現: Preview デプロイ + 固定エイリアス** — clarify 回答（Vercel 同一プロジェクト）どおり。`vercel alias` で stg 固定 URL を張る。環境変数は Vercel の Preview / Production スコープで分離（FR-015）。
3. **prod 承認 1 回の実現: approval 専用 Environment 方式** — required reviewers を `production-approval`（シークレットなし）だけに置き、ゲートジョブ 1 つが承認を受ける。後続の DB / アプリジョブは `production`（シークレットあり・reviewers なし）を参照。ジョブごとに承認を求められる問題を回避し SC-002 を満たす。
4. **テスト前提（FR-007）: ブランチ保護の required checks** — develop / main を PR 必須 + 既存 CI ジョブを required checks に設定（初期セットアップ手順に含める）。デプロイワークフロー内でのテスト再実行はしない。
5. **マイグレーション適用: `supabase db push`** — マイグレーション履歴で適用済みをスキップ（FR-005 の冪等性）。`supabase config push` は対象外（Auth 設定等の本番反映は手動と README に明記）。
6. **直列化: concurrency グループ `deploy-<environment>`** — `cancel-in-progress: false` でキューイングし、デプロイは完走させ追い越しを防ぐ（FR-009）。

## Phase 1: Design & Contracts

- **データモデル**: [data-model.md](data-model.md) — DB スキーマ変更なし。環境（staging / production）・シークレット・Vercel 環境変数の構成モデルと配置先の対応表。
- **契約**:
  - [contracts/workflows.md](contracts/workflows.md) — `_deploy.yml` の inputs / secrets、ジョブグラフ（migrate → deploy-service-front + deploy-admin-front）、失敗時の挙動、concurrency、再実行契約。
  - [contracts/secrets-and-envs.md](contracts/secrets-and-envs.md) — GitHub Environments 3 つの定義、シークレット一覧（名前 / 用途 / 取得元 / 設定場所）、Vercel 側環境変数（Preview / Production スコープ）一覧。README のシークレット表の原本。
- **検証手順**: [quickstart.md](quickstart.md) — 外部サービスの初期セットアップ（Supabase 2 プロジェクト・Vercel 2 プロジェクト・Environments・ブランチ保護）→ develop ダミーマージで stg 検証 → main マージ + 承認で prod 検証 → 失敗系（マイグレーション失敗でアプリが止まる）の確認。
- **Agent context 更新**: `.claude/CLAUDE.md` の SPECKIT マーカーを本 plan へ更新。

**Post-Design Constitution Re-check**: シークレットの環境分離・最小権限を契約に明文化。アプリコード・DB スキーマへの影響なし。違反なし。
