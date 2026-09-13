# Implementation Plan: モバイルアプリ（第 1 段階: オフラインログ作成・転送・閲覧・エクスポート）

**Branch**: `029-mobile-offline-logs` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/029-mobile-offline-logs/spec.md`

## Summary

圏外の現場でログを作成し、通信回復後に自動転送する iOS / Android モバイルアプリの第 1 段階。閲覧（全件一括ダウンロードによるオフライン閲覧）とエクスポート（オンライン時・既存 Web 基盤の再利用）を含む。

技術方針（research.md で確定）:

1. **Expo（managed）+ expo-router** で monorepo に新ワークスペース `mobile/` を追加。Web のコードは変換されないため UI は新規実装だが、ドメインロジック・スキーマは共有パッケージに抽出して単一ソース化する
2. **冪等転送はクライアント生成 UUID を `dives.id` に使う**: 既存の INSERT ポリシーは `user_id` のみを検証するため、端末で採番した UUID を主キーとして送信すれば、リトライは 23505（PK 重複）となり冪等成功に変換できる（FR-005）。**サーバー側のマイグレーションは不要**
3. **端末内は SQLite の単一ソース**: 転送待ちキュー（`pending_dives`）とサーバーコピー（`cached_dives`）を expo-sqlite に永続化。UI は常に SQLite を読む cache-first 構成で、オンライン時は自動リフレッシュ + 明示の「オフライン用に同期」で全件を保証する（FR-002/011/012）
4. **入力検証の同等性は共有パッケージで担保**: `dive.schema.ts`（yup）と関連定数・型を新設 `packages/core` へ移動し、service-front は既存パスから re-export（既存 import・テスト無変更）。モバイルは同じスキーマを直接使う（FR-008）
5. **エクスポートは既存 `/dives/export` ルートを再利用**: ルートに Bearer トークン認証を追加する最小変更（UI 変更なし）。モバイルはアクセストークン付きでダウンロードし、共有シートへ渡す（FR-015〜017）
6. **認証は supabase-js + SecureStore**: メールログインは直接、Google は AuthSession + ディープリンク。転送待ちデータはセッション状態と独立に保持する（FR-018〜020）

## Technical Context

**Language/Version**: TypeScript（strict）/ React Native 0.86 + Expo SDK 57 + expo-router 57（ファイルベースルーティング。ルートは `mobile/src/app/`）

**Primary Dependencies**: expo / expo-router / expo-sqlite（ローカル永続化）/ expo-secure-store（セッション保存）/ expo-auth-session（Google OAuth）/ expo-file-system + expo-sharing（エクスポート保存・共有）/ @supabase/supabase-js / yup（共有スキーマ）。スタイルは StyleSheet + `mobile/src/theme/tokens.ts`（packages/ui のトークン値を移植。**実装時判断**: NativeWind は RN 0.86 / SDK 57 との互換が未検証のため第 1 段階では採用せず、トークン移植方式とした）

**Storage**: 端末 = SQLite（`pending_dives` / `cached_dives` / `sync_meta`）。サーバー = 既存 `dives` テーブルのみ（**新規テーブル・マイグレーションなし**）

**Testing**: 純粋ロジック（同期状態機械・キュー・変換・スキーマ）= Vitest（`packages/core` と RN 非依存の `mobile/src` ロジック）。RN コンポーネント = jest-expo + React Native Testing Library（Vitest が RN に非対応のため。Complexity Tracking 参照）。E2E 相当は quickstart.md の実機/シミュレータ手動検証

**Target Platform**: iOS / Android（スマートフォン）。Expo Go で開発、配布（EAS Build / ストア申請）は将来段階

**Project Type**: モバイルアプリ（既存 npm workspaces monorepo への `mobile/` ワークスペース追加 + `packages/core` 新設）

**Performance Goals**: 圏外での保存は即時（ローカル書き込みのみ / SC-001）。転送はフォアグラウンド復帰・通信回復から 1 分以内に開始（SC-002）。全件同期はログ 500 件で 30 秒以内（テキストのみ・ページング取得）

**Constraints**: バックグラウンド転送なし（Clarification Q1）。オフラインは新規作成 + キャッシュ閲覧のみ（編集・削除はオンライン限定）。写真・ソーシャル・通知はスコープ外。ダウンロードは全件一括のみ（Q2）。エクスポートはオンライン限定（Q3）

**Scale/Scope**: 画面 6 枚程度（ログイン / ログ一覧 / ログ詳細 / ログ作成 / 転送待ち表示 / 設定・エクスポート）+ 同期エンジン。service-front の変更はエクスポートルートの Bearer 対応とスキーマ re-export 化のみ

## Constitution Check

*GATE: Phase 0 前に通過必須。Phase 1 設計後に再評価。*

| 原則 | 判定 | 対応方針 |
|------|------|----------|
| I. Spec-Driven Development | PASS | spec → clarify（3 問確定済み）→ plan の順で進行 |
| II. Server Components First | PASS（適用範囲: Web） | 本原則は Next.js（service-front / admin-front）所管。モバイルはクライアントアプリのため概念自体が存在しない。service-front 側の変更（エクスポートルート・re-export）は既存構造を維持 |
| III. Test-First（テスト同梱） | 条件付き PASS | 同期エンジン・キュー・スキーマ等の中核ロジックは Vitest 先行（RN 非依存の純粋関数として設計）。RN コンポーネントのみ jest-expo を使用（Complexity Tracking に記載） |
| IV. Security & RLS by Default | PASS | サーバー側スキーマ変更なし。モバイルからの書き込みは既存 RLS（users can insert own dives）が防御。端末内データは本人分のみ（FR-019）・セッションは SecureStore（OS キーチェーン）に保存。anon キーのみ使用 |
| V. Accessibility | PASS | WCAG は Web 基準のため RN の同等手段で担保: accessibilityRole / accessibilityLabel / accessibilityState・44pt タッチターゲット・コントラスト AA・動的フォントサイズ追従 |
| VI. Coding Standards | PASS | TypeScript strict / any 禁止 / Feature-based 構成を mobile にも適用（mobile/src/features/...）。コンポーネントフォルダ構成は本体 + テスト + index.ts（Storybook 未採用のため stories 不要 = admin-front と同扱い） |

**GATE 結果**: 違反なし（jest-expo の採用のみ Complexity Tracking に記載）。

## Project Structure

### Documentation (this feature)

```text
specs/029-mobile-offline-logs/
├── plan.md              # This file
├── research.md          # Phase 0 output（Expo / SQLite / 冪等転送 / 共有パッケージの決定）
├── data-model.md        # Phase 1 output（端末内 SQLite スキーマ・状態遷移・サーバー影響なしの確認）
├── quickstart.md        # Phase 1 output（機内モード検証シナリオ）
├── contracts/           # Phase 1 output
│   ├── sync-protocol.md         # 転送プロトコル（冪等性・状態機械・リトライ・認証切れ）
│   └── app-screens.md           # 画面・ナビゲーション・共有パッケージ境界
└── tasks.md             # /speckit-tasks で作成
```

### Source Code (repository root)

```text
package.json                          # 変更: workspaces に "mobile" を追加

packages/core/                        # 新規: Web / モバイル共有のドメインパッケージ（@repo/core）
├── src/
│   ├── schemas/dive.schema.ts        # service-front から移動（yup スキーマ + 入力型）
│   └── constants/                    # スキーマが依存する選択肢定数（ダイブタイプ等）
└── package.json

service-front/src/features/dives/
└── schemas/dive.schema.ts            # 変更: @repo/core からの re-export に置換（既存 import 無変更）
service-front/src/app/(authenticated)/dives/export/route.ts
                                      # 変更: Authorization: Bearer でも認証可能に（cookie 認証は維持）

mobile/                               # 新規: Expo アプリ（React Native）
├── app/                              # expo-router
│   ├── _layout.tsx                   # ルート（認証ゲート + 同期エンジン起動）
│   ├── (auth)/login.tsx              # ログイン（メール / Google）
│   ├── (tabs)/index.tsx              # ログ一覧（キャッシュ + 転送待ちを統合表示）
│   ├── (tabs)/new.tsx                # ログ作成（オフライン対応）
│   ├── (tabs)/settings.tsx           # 設定（同期・エクスポート・ログアウト）
│   └── dives/[id].tsx                # ログ詳細
├── src/
│   ├── features/
│   │   ├── dives/                    # 一覧・詳細・作成フォーム（@repo/core のスキーマを使用）
│   │   ├── sync/                     # 同期エンジン（キュー処理・状態機械・トリガー）
│   │   └── export/                   # エクスポート（ルート呼び出し + 共有シート）
│   ├── lib/
│   │   ├── db/                       # expo-sqlite ラッパー（pending/cached/meta の DAL）
│   │   └── supabase/                 # supabase-js クライアント（SecureStore アダプタ）
│   └── theme/tokens.ts               # packages/ui のトークン値を移植（NativeWind は互換未検証のため不採用）
├── app.json / metro.config.js        # monorepo 対応（watchFolders / nodeModulesPaths）
└── package.json
```

**Structure Decision**: モバイルは独立ワークスペース mobile/（service-front / admin-front と同列）。Web との共有は「UI 以外」に限定し、新設 packages/core にスキーマ・定数・型を置く（R4/R6）。service-front の既存ファイルは re-export 化のみで振る舞い不変。同期エンジンは UI から独立した features/sync/ に隔離し、状態機械・キュー判断は RN 非依存の純粋関数として書いて Vitest でテストする。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| RN コンポーネントテストに jest-expo を使用（constitution III は Vitest 指定） | Vitest は React Native のネイティブモジュール解決・トランスフォームに非対応で、RN コンポーネントの実行環境を提供できない | 「コンポーネントテストを書かない」は Test-First 原則へのより大きな違反。ロジックを純粋関数へ抽出して Vitest でテストし、RN 依存部のみ jest-expo に限定して乖離を最小化 |
