# Contracts: 転送プロトコル（同期エンジン）

**Feature**: 029-mobile-offline-logs | **Plan**: [../plan.md](../plan.md)

## 転送の単位と順序

- 転送対象: `pending_dives` の `status in ('pending')` の行（`failed` は手動再転送でのみ復帰）
- **1 件ずつ直列処理**、`created_at` 昇順（作成順を保つ）。進捗は「n / 全件」で UI へ通知（SC-005）

## トリガー（research R8 / Clarification Q1）

| トリガー | 実装 |
|---------|------|
| アプリ起動・フォアグラウンド復帰 | AppState 変化で起動 |
| ネットワーク回復 | expo-network の接続状態監視 |
| 手動 | 転送待ち表示の「再転送」ボタン（FR-006） |

同時多重起動の防止: エンジンはシングルトンで、実行中の再入はスキップ（次サイクルに委ねる）。

## 1 件の転送シーケンス

```text
1. status を syncing に更新（SQLite トランザクション）
2. payload → dives INSERT 行へ変換（@repo/core の変換関数。id = pending_dives.id, user_id = セッションユーザー）
3. supabase.from('dives').insert(row)
4. 結果:
   - 成功            → cached_dives へ upsert + pending 行削除（=転送済み）
   - error 23505     → 既に転送済み（前回のレスポンス欠落）。成功と同じ処理（冪等 / FR-005）
   - ネットワーク例外 → status を pending へ戻す。エンジンを中断し次トリガーへ（指数バックオフ）
   - その他エラー     → status = failed + error_message 保存（42501 = 権限、22xxx/23xxx = データ不正 等）。次の行へ進む
```

## 認証との関係（FR-020）

- 転送前にセッションを確認。失効していればリフレッシュを試み、失敗なら**キューに触れず**「再ログインが必要」の状態を UI に返す（データ消失ゼロ / SC-007）
- 再ログインは同一ユーザーのときのみキュー転送を再開。別ユーザーなら旧ユーザーの pending は非表示・転送停止のまま保持（FR-019）

## 全件同期（ダウンロード / FR-011〜012）

- 明示操作「オフライン用に同期」: `dives` を keyset ページング（100 件/頁）で全件取得 → `cached_dives` を該当 user_id で置換 → `sync_meta.last_full_sync_at` 更新
- 置換方式のため、Web 側で削除されたログはキャッシュからも消える（FR-012）
- オンラインでの一覧表示時は、表示ページ分のみ upsert する機会的リフレッシュを行う（明示同期の代替にはしない）

## エクスポート連携（FR-015〜017 / research R5）

- `GET {SITE_URL}/dives/export?format=csv|pdf&ids=...` を `Authorization: Bearer <access_token>` 付きで取得
- service-front 側の契約変更: ルートは cookie 認証に加えて Bearer トークンを受け付ける（specs/014 の契約への追記。レスポンス仕様・ファイル名規約は不変）
- 取得ファイルは expo-file-system で保存 → expo-sharing で共有シートへ（保存先の恒久管理はアプリの責務外）
- 圏外時はリクエストせず案内を表示（Clarification Q3）

## テスト契約（Vitest 先行・RN 非依存の純粋関数として）

- 状態機械: pending→syncing→(成功|23505|網断|拒否) の遷移が仕様どおり / syncing 残留の起動時復旧
- 変換: DiveFormValues → dives 行のラウンドトリップ / id・user_id の固定
- キュー判断: 直列順序・failed スキップ・再入抑止
- 23505 / 42501 / ネットワーク例外の分類ロジック
