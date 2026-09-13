# Tasks: デプロイパイプライン（GitHub Actions による stg / prod 自動反映）

**Input**: Design documents from `/specs/028-deploy-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: アプリコード変更なしのため単体テストは対象外（憲法 III の適用除外 / plan 参照）。検証は actionlint（静的）+ quickstart（実環境）で行う。

**Organization**: US1: stg 自動反映 / US2: prod 反映 + 承認 / US3: README 整備。外部サービスのダッシュボード操作（🖐 マーク）は人間の作業。

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: stg / prod 共通のデプロイ実体

- [X] T001 `.github/workflows/_deploy.yml`（reusable workflow）を新規作成する（contracts/workflows.md）: inputs.environment、migrate ジョブ（supabase/setup-cli → link → db push）→ deploy-service-front / deploy-admin-front 並列（vercel pull → build → deploy --prebuilt、staging のみ alias、production のみ --prod）、permissions: contents read、ジョブサマリーへのデプロイ URL 出力

**Checkpoint**: 呼び出し可能なデプロイ実体が存在する

---

## Phase 2: User Story 1 - develop マージで stg 自動反映 (Priority: P1) 🎯 MVP

**Goal**: develop マージ → DB → 両アプリの順で stg へ無人反映

**Independent Test**: develop へのダミーマージで stg URL に変更が反映され、マイグレーションが stg DB に適用される（quickstart 1）

- [X] T002 [US1] `.github/workflows/deploy-stg.yml` を新規作成する（on: push develop / concurrency deploy-staging・cancel-in-progress: false / _deploy.yml を environment=staging・secrets: inherit で呼ぶ）
- [X] T003 [US1] `actionlint` で 3 ワークフロー（既存 2 + 新規）の静的検証を通す（`brew install actionlint` または `npx`。指摘があれば修正）
- [ ] T004 [US1] 🖐 stg の外部セットアップ: Supabase stg プロジェクト作成 / Vercel 2 プロジェクト作成（Root Directory 設定・**Git 連携の自動デプロイ無効化**）/ Vercel 環境変数（Preview スコープ）設定 / GitHub Environment `staging` 作成 + シークレット設定（contracts/secrets-and-envs.md の表どおり）
- [ ] T005 [US1] 🖐 Stripe テストモードに stg webhook エンドポイントを登録し、`whsec_...` を Vercel（Preview）へ設定（quickstart 0-3）
- [ ] T006 [US1] quickstart 1 を実施: ダミーマージ → stg 反映（15 分以内）・マイグレーション適用・再実行の冪等性・ブランチ保護での CI 前提を確認

**Checkpoint**: stg 環境が「マージ → 自動反映」で運用可能（MVP）

---

## Phase 3: User Story 2 - main マージで prod 反映 (Priority: P2)

**Goal**: main マージ → 承認 1 回 → prod へ反映。承認まで prod 無変更

**Independent Test**: main マージで承認待ち停止 → 承認で反映 / 却下で無変更（quickstart 2）

- [X] T007 [US2] `.github/workflows/deploy-prod.yml` を新規作成する（on: push main / concurrency deploy-production / approve ゲートジョブ（environment: production-approval）→ needs: approve で _deploy.yml を environment=production で呼ぶ）
- [ ] T008 [US2] 🖐 prod の外部セットアップ: Supabase prod プロジェクト作成 / Vercel 環境変数（Production スコープ・Stripe は本番モードキー）/ GitHub Environments `production-approval`（required reviewers 設定）+ `production`（シークレット）作成 / develop・main のブランチ保護（PR 必須 + CI required checks）
- [ ] T009 [US2] 🖐 Stripe 本番モードに prod webhook エンドポイントを登録し、`whsec_...` を Vercel（Production）へ設定
- [ ] T010 [US2] quickstart 2・3 を実施: 承認待ち停止・承認 1 回での反映・却下時の無変更・マイグレーション失敗時のアプリ反映中止・失敗ジョブのみ再実行・連続マージの直列化を確認

**Checkpoint**: prod への安全な反映経路が完成

---

## Phase 4: User Story 3 - README 整備 (Priority: P3)

**Goal**: README だけで仕組みの理解と初期セットアップの再現ができる

**Independent Test**: README のみを参照してシークレット設定の準備が 1 時間以内に完了できる（SC-005）

- [X] T011 [US3] ルート `readme.md` に「デプロイ」章を新規作成する: ブランチ ↔ 環境の対応図 / パイプラインの流れ（DB → アプリ・承認ゲート）/ シークレット・環境変数の一覧表（contracts/secrets-and-envs.md から転記）/ 初期セットアップ手順（quickstart 0 を利用者向けに清書）/ トラブルシューティング（再実行・手動デプロイ・migrate 失敗時の対処）
- [X] T012 [P] [US3] `service-front/README.md` / `admin-front/README.md` / `supabase/README.md` にルートのデプロイ章への参照リンクを追記する（既存の相互リンク方針に合わせる）
- [ ] T013 [US3] quickstart 4 を実施: README のみでセットアップ再現可否のレビュー + `git grep -iE 'sk_live|whsec_|sbp_'` で平文シークレット 0 件を確認

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T014 `/sync-spec` を実行し、実装（ワークフロー・README）と specs/028 のずれを解消する

---

## Dependencies & Execution Order

- T001 → T002（stg）/ T007（prod）が依存
- T004・T005（外部セットアップ）は T006 の前提。T008・T009 は T010 の前提
- US2（Phase 3）は US1 完了後を推奨（stg で検証済みの仕組みを prod に複製する運用のため）
- T011 は全シークレット名確定後（T001・T002・T007 完了後）が正確

### Parallel Opportunities

- T002 と T003 の一部、T012 の 3 ファイルは並行可
- 🖐 の外部セットアップはコード作成（T001〜T003）と並行で進められる

## Implementation Strategy

**MVP = Phase 1〜2（stg まで）**。stg 運用で仕組みの信頼性を確認してから prod（US2）を有効化する。README（US3）はシークレット名が固まった時点でいつでも書ける。

## Notes

- 🖐 タスクはダッシュボード操作が必要（リポジトリのコード変更なし）。Claude 側では手順提示と検証のみ可能
- コミットは `feat(028): ...` / `docs(028): ...` 形式
