# Contract: 匿名共有 RPC `get_public_dive`（廃止済み）

> **廃止（2026-07-01）**: 匿名共有ページ `/(public)/shared/dives/[slug]` を廃止し、公開ログの閲覧を認証済みの `/dives/[id]` に統合したため、この RPC は `drop function`（`20260701130000_drop_get_public_dive_fn.sql`）した。公開ログの閲覧は `dives` の RLS「authenticated can read public dives」＋ `getDive`／`/dives/[id]` で担保する。共有リンクは dive id ベースの `{SITE_URL}/dives/[id]`。以下は廃止前の仕様（参考）。

~~未ログインの共有ページ（`/(public)/shared/dives/[slug]`）から呼ぶ。詳細 DDL は data-model.md §4。~~

## RPC `get_public_dive(p_slug text)`

| 項目 | 内容 |
|---|---|
| 種別 | `security definer`, `set search_path = ''`, `stable` |
| 実行権限 | `anon`, `authenticated`（`public` からは revoke） |
| 入力 | `p_slug`: 共有 slug |
| 条件 | `public_slug = p_slug` **かつ** `is_public = true` のみ返す |
| 出力 | 0 行（非公開/存在しない）または 1 行：`id, dive_date, location, max_depth_m, bottom_time_min, notes, owner_nickname` |

## ページ動作（FR-011）

| 状態 | 結果 |
|---|---|
| 公開ログの有効 slug | 共有ビューを表示（`generatePageMetadata` で OGP） |
| 非公開化された slug | 0 行 → 404（SC-005：非公開化で即遮断） |
| 不正・未知 slug | 0 行 → 404 |

## セキュリティ根拠

- テーブル RLS を anon に広げず、slug 指定 1 件のみ返すため列挙耐性が高い（research R2 / SC-002）。
- 返却列は共有に必要な最小限。バディ・写真等を出す場合は本 RPC の出力列をタスクで明示拡張する。
