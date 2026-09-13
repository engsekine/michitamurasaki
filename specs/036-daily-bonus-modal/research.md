# Research: デイリーボーナス獲得モーダル

**Date**: 2026-07-17 | **Feature**: [spec.md](./spec.md)

## R1. 「付与が実際に発生した」ことの検知方法（FR-001 の核心）

- **Decision**: `grant_daily_bonus()` の返り値を `void` → `boolean`（付与したら `true`、当日分付与済みなら `false`）に変更するマイグレーションを追加する。返り値の型変更のため `create or replace` では不可、`drop function` + `create function` で作り直し、`security definer` / `set search_path = ''` / `revoke`・`grant execute to authenticated` を再設定する
- **Rationale**: 現行の RPC は `returns void` で、呼び出し元（authenticated layout）は付与が起きたか判別できない。関数内の `unique_violation` ハンドリング箇所が「付与済み」を既に区別しているため、そこで `false` を返すだけで冪等性・並行安全性（部分ユニーク制約）はそのまま活きる。並行リクエストでも `true` を受け取るのは 1 リクエストだけなので、モーダルの重複表示（SC-001）も DB 層で保証される
- **Alternatives considered**:
  - ledger を再 SELECT して直近の `daily_bonus` 行の作成時刻で判定 — 追加クエリ + 時刻閾値のヒューリスティックで並行時に誤判定しうる。却下
  - Cookie / セッションフラグで「今日表示したか」を管理 — 「表示したか」は管理できても「付与が発生したか」は検知できず、付与失敗時に誤表示する（FR-005 違反）。却下
  - 新しい別関数（`grant_daily_bonus_v2`）を追加 — 呼び出し箇所は 1 箇所だけなので既存関数の作り直しで十分。関数の重複は却下

## R2. モーダルの表示制御（どこで・いつ描画するか）

- **Decision**: `(authenticated)/layout.tsx` の既存 RPC 呼び出しで `granted`（boolean）を受け取り、`granted === true` のときのみ残枠数を `getCreditBalance()`（既存クエリ）で取得して `<DailyBonusModal remainingCredits={n} />` を `children` と並べて描画する
- **Rationale**:
  - 付与は認証済み領域への当日初アクセスで発生する（既存仕様）ため、付与を検知できるのは layout だけ。spec の「特定ページに限定しない」（Assumptions）とも一致する
  - App Router の layout はクライアントナビゲーションでは再実行されないため、ページ遷移でモーダルの状態が消えることはなく、ハードリロード時は RPC が `false` を返すので再表示されない。FR-003 / SC-002 が追加の状態管理なしで成立する
  - 残枠取得（`getCreditBalance`）は `granted === true` のときだけ実行するので、通常アクセス（1 日の 2 回目以降）のレイテンシは増えない
- **Alternatives considered**:
  - 表示済みフラグを Cookie / localStorage に保存 — R1 の boolean 返却で不要になる冗長な状態。却下
  - TOP ページのみに表示 — 付与は任意のページで発生するため取り逃す（/dives 直行のユーザーなど）。却下

## R3. モーダルコンポーネントの実装方式

- **Decision**: `features/credits/components/client/DailyBonusModal/` に Client Component として新設し、既存の `Dialog` ラッパー（`@/shared/components/ui/Dialog`、shadcn ベース）を使用する。マウント時に open で表示し、閉じる操作（closeボタン・Esc・オーバーレイ）で `open=false`。「ログを書く」は `/dives/new` への遷移
- **Rationale**: Dialog ラッパーは `role="dialog"` / `aria-modal` / フォーカストラップ / Esc クローズを備えており FR-006（WCAG 2.1 AA）を既存資産で満たせる。shadcn / `@repo/ui` は直接使わずラッパー経由（rules/react.md）。クライアント境界は「開閉状態」を持つモーダル 1 点のみで最小（Constitution II）
- **Alternatives considered**:
  - 素の `<div role="dialog">` を自作 — フォーカストラップ等を再実装することになる。既存ラッパーがあるため却下
  - トースト（画面隅の通知） — プロジェクトにトースト基盤がなく、ユーザー要望も「モーダルで表示」。却下

## R4. 既存 E2E テストへの影響とシーダー更新

- **Decision**: `supabase/seed.sql.template` を更新し、既存の E2E 用ユーザー（`test@` / `buddy@` / `rename@` / `admin@`）には **当日（JST）分の `daily_bonus` を事前付与**しておく。加えてモーダル検証専用のシードユーザー **`bonus@example.com`**（当日分未付与・handle: `bonus-hanako`）を新設する
- **Rationale**: モーダル導入後、db reset 直後に最初にログインした E2E テストへ突然モーダルが被さり、既存テストのクリック操作を妨害してフレーキーになる。既存ユーザーへ当日分を事前付与しておけば `grant_daily_bonus` が全テストで no-op（`false`）になり、既存 E2E は一切影響を受けない。モーダルの表示検証は専用ユーザーで行う（初回ログインで `true` → モーダル表示）
- **注意点（ドキュメント化する）**: seed 実行日と E2E 実行日が JST でまたがると事前付与が「昨日の分」になり既存テストにモーダルが出る。E2E 実行前に `make supabase-reset` を行う運用（既存の前提）で回避される。モーダル表示テストも同じ理由で db reset 後 1 回のみ成立（再実行は reset が必要）
- **Alternatives considered**:
  - 各 E2E テストの login ヘルパーで「モーダルが出ていたら閉じる」— 全 spec ファイルに散らばり、タイミング依存で不安定。却下
  - E2E 用に付与機能を無効化する環境変数 — テストが本番挙動から乖離する。却下

## R5. テスト戦略（Test-First の適用点）

- **Decision**: 検証レイヤーを 3 段に分ける
  1. **DB 統合テスト（Vitest）**: 既存の `features/credits/server/creditRules.test.ts` に「初回呼び出しは `true`、同日 2 回目は `false` を返す」を追加（ローカル Supabase 直結の既存パターン）
  2. **コンポーネント単体（Vitest）+ Story**: `DailyBonusModal` の表示内容（+1 枠・残枠数）、閉じる操作、`/dives/new` 導線
  3. **E2E（Playwright）**: `bonus@example.com` で初回ログイン → モーダル表示 → 閉じる → リロードで再表示なし。a11y（axe）はモーダル表示状態で検証
- **Rationale**: FR-001 の本質（付与有無の返却）は DB 層の責務なので DB 統合テストで固定し、UI はモックした props で単体検証、結合の成立だけを E2E で確認する。各層が独立して壊れた箇所を特定できる
