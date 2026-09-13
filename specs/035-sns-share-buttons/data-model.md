# Data Model: SNS 共有ボタン

**Date**: 2026-07-16 | **Feature**: [spec.md](./spec.md)

## 結論: DB 変更なし

本機能は新しいデータを保存しない（spec Assumptions）。マイグレーション・RLS ポリシー・シードデータの変更は一切発生しない。

## 参照する既存データ

| データ | 取得元（既存） | 用途 |
|--------|--------------|------|
| `dives.id` / `dives.is_public` / `dives.location` / `dives.dive_date` | `getDive(id)`（`features/dives`） | 共有ボタンの表示条件（`is_public`）・共有 URL（`/dives/[id]`）・共有テキスト（場所・日付） |
| `user_details.handle` / `user_details.nickname` / `user_details.user_id` | `requireProfileBySlug(slug)`（`features/social`） | 共有 URL（`profilePath`）・共有テキスト（ニックネーム） |

いずれも埋め込み元ページが既にフェッチ済みの値を使うだけで、新規クエリ・RPC の追加もない。

## クライアント側の一時状態

なし（2026-07-16 改定）。Instagram 共有の削除に伴いクリップボードコピーの状態管理が不要になり、`SnsShareButtons` は状態を持たない Server Component となった。
