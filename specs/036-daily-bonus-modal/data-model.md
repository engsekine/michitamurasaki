# Data Model: デイリーボーナス獲得モーダル

**Date**: 2026-07-17 | **Feature**: [spec.md](./spec.md)

## テーブル変更なし・関数変更あり

新しいテーブル・カラム・RLS ポリシーは追加しない。既存の `credit_ledger`（026）の構造・部分ユニーク制約（`daily_bonus` × ユーザー × JST 暦日で 1 行）はそのまま利用する。

## 関数変更: `grant_daily_bonus()`

**マイグレーション**: `supabase/migrations/20260717XXXXXX_alter_grant_daily_bonus_return_granted.sql`

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| 返り値 | `void` | `boolean`（付与が発生したら `true`、当日分付与済みなら `false`） |
| 付与ロジック | `apply_credit_ledger_entry(..., 'daily_bonus', 1, JST今日)` | 変更なし |
| 冪等性 | `unique_violation` を握りつぶし | `unique_violation` で `return false` |
| セキュリティ | `security definer` / `set search_path = ''` | 同一（作り直し時に再設定） |
| 権限 | `revoke all from public` + `grant execute to authenticated` | 同一（作り直し時に再設定） |

- 返り値型の変更のため `create or replace` は使えず、`drop function public.grant_daily_bonus();` してから `create function` する（1 マイグレーション 1 目的の範囲内。関数と権限は強い依存のため同一ファイルで OK）
- `comment on function` も再設定し「返り値 = 付与発生の有無（獲得モーダルの表示判定に使用）」を明記する
- 既存呼び出し（authenticated layout）は返り値を無視していたため後方互換

## 型定義の同期

- `packages/supabase/src/types.ts`: `grant_daily_bonus: { Args: never; Returns: undefined }` → `Returns: boolean`

## シードデータ変更（`supabase/seed.sql.template`）

| 変更 | 内容 | 理由 |
|------|------|------|
| 既存 4 ユーザーへ当日分事前付与 | `select public.apply_credit_ledger_entry('<user_id>', 'daily_bonus', 1, (now() at time zone 'Asia/Tokyo')::date);` を `test@` / `buddy@` / `rename@` / `admin@` に追加 | 既存 E2E の初回ログインでモーダルが出て操作を妨害するのを防ぐ（research.md R4） |
| 新規ユーザー `bonus@example.com` | 既存ユーザーと同形式（auth.users + identities + meta で handle: `bonus-hanako`）。**daily_bonus は事前付与しない** | モーダル表示 E2E 専用（初回ログインで付与 → モーダル表示） |

注意: seed 実行日と E2E 実行日が JST でまたがると事前付与が「前日分」となり効果を失う。E2E は `make supabase-reset` 直後に実行する既存運用を前提とする。

## クライアント側の一時状態（永続化しない）

`DailyBonusModal` 内のローカル state のみ:

| 状態 | 型 | 意味 |
|------|----|------|
| `open` | `boolean` | モーダルの開閉。マウント時 `true`、閉じる操作で `false`。同日再表示の抑止は RPC の `false` 返却（サーバー側）で担保するためクライアントに永続状態は持たない |
