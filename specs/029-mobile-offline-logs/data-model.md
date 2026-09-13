# Data Model: モバイルアプリ（第 1 段階）

**Date**: 2026-07-06 | **Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 0. サーバー側（Supabase）— 変更なし

新規テーブル・カラム・RLS 変更・マイグレーションは **一切なし**。

- 転送先は既存 `public.dives`。冪等性は「クライアント採番 UUID を `id` に使う」ことで既存 PK が担保（research R2）
- 既存 RLS `users can insert own dives`（`user_id = auth.uid()`）がモバイルからの書き込みを防御
- 読み取り（一覧・詳細・全件同期）も既存 `users can read own dives` の範囲

## 1. 端末内 SQLite スキーマ（expo-sqlite）

命名は snake_case（sql.md 準拠）。すべてのテーブルは単一ユーザー端末を前提にせず `user_id` を持つ（FR-019: 別ユーザーでログインしたとき他人のデータを見せない・送らない）。

### 1-1. `pending_dives`（転送キュー）

オフラインで作成されたログ。転送が完了したら行を削除し `cached_dives` へ移す。

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| `id` | text | PK | 端末で採番した UUID。**そのまま `dives.id` になる**（冪等キー / FR-005） |
| `user_id` | text | not null | 作成時のログインユーザー |
| `payload` | text | not null | ログ入力値の JSON（@repo/core の入力型。キーは Web のフォーム値と同一） |
| `status` | text | not null / check: `pending` `syncing` `failed` | 転送状態（FR-003。`synced` は行削除 + cached 移動で表現） |
| `error_message` | text | | 失敗理由（status=failed のとき / FR-006） |
| `created_at` | text | not null | 端末での作成日時（ISO 8601） |
| `updated_at` | text | not null | 状態変更日時 |

### 1-2. `cached_dives`(サーバーコピー / オフライン閲覧用)

読み取り専用のキャッシュ。全件同期・オンライン閲覧時の自動リフレッシュで upsert される（FR-011/012）。

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| `id` | text | PK | `dives.id` |
| `user_id` | text | not null | 所有者 |
| `dive_date` | text | not null | 一覧の並び替え用（payload から冗長化。SQL で order by するため） |
| `payload` | text | not null | サーバーから取得したログ全項目の JSON |
| `synced_at` | text | not null | このコピーを取得した日時 |

- インデックス: `(user_id, dive_date desc, id desc)`（一覧表示・keyset）

### 1-3. `sync_meta`（同期メタデータ）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| `user_id` | text | PK | ユーザーごとに 1 行 |
| `last_full_sync_at` | text | | 最後に全件同期が完了した日時（null = 未実行。FR-013 の案内判定に使用） |

## 2. 状態遷移（pending_dives.status）

```text
（作成・保存）
    → pending ──（転送トリガー: 起動/復帰・通信回復・手動）→ syncing
                   syncing ──成功（INSERT 成功 or 23505）→ 行削除 + cached_dives へ upsert（=「転送済み」）
                   syncing ──通信エラー→ pending（次のトリガーで自動再試行 / バックオフ）
                   syncing ──サーバー拒否（RLS/検証エラー等）→ failed（error_message 保存）
    failed ──（手動再転送 / FR-006）→ syncing
```

- `syncing` のままアプリが強制終了した場合、次回起動時に `pending` へ戻す（転送は冪等なので安全 / SC-007）
- 一覧表示は `cached_dives ∪ pending_dives` を日付降順で統合し、pending 由来には状態バッジを付ける（FR-014）

## 3. ライフサイクル

| イベント | pending_dives | cached_dives | sync_meta |
|----------|--------------|--------------|-----------|
| 圏外で作成 | INSERT（pending） | — | — |
| 転送成功 | 行削除 | upsert（転送済みログとして閲覧可能に） | — |
| 全件同期（明示） | — | サーバー全件で置換（削除済みログはキャッシュからも消える） | `last_full_sync_at` 更新 |
| オンライン一覧表示 | — | 取得ページ分を upsert（機会的リフレッシュ） | — |
| ログアウト | 未転送があれば警告 → 確認後に該当 user_id の行を全削除 | 同左 | 同左 |
| 別ユーザーでログイン | 他ユーザーの行は表示・転送対象にしない（user_id で分離） | 同左 | 同左 |

## 4. payload の形（@repo/core）

- `pending_dives.payload` は Web のログ作成フォームと同一の入力型（`@repo/core` の `DiveFormValues` 相当）を JSON 化したもの。転送時に snake_case の `dives` INSERT 行へ変換する（変換関数も `@repo/core` に置き、Vitest でラウンドトリップを検証）
- バリデーションは保存前に `@repo/core` の yup スキーマで実行（FR-008。Web と同一スキーマのため同等性が定義上成立）
