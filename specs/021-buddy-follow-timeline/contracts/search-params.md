# Contract: バディ検索パラメータ（013 拡張）

既存の `features/dives/lib/search-params.ts`（`parseDiveFilter` / `filterToSearchParams`）と `list-query.ts` を拡張。寛容パース方針（不正値はそのパラメータのみ無視）を踏襲。

## 追加 URL パラメータ

| パラメータ | 型 | 例 | `DiveListFilter` フィールド | 説明 |
|---|---|---|---|---|
| `buddy` | uuid | `?buddy=<userId>` | `buddyUserId?: string` | 登録ユーザーのバディで絞り込み。uuid 形式でなければ無視 |
| `buddy_name` | text(≤100) | `?buddy_name=Taro` | `buddyName?: string` | フリーテキストバディの部分一致（trim・100 文字に丸め） |

`buddy` と `buddy_name` は併用可（AND）。既存フィルタ（number/date/depth/type/q）とも AND。

## クエリ適用（`list-query.ts`）

| 入力 | 動作 |
|---|---|
| `buddyUserId` | `dive_log_buddies` に `(dive_id, buddy_user_id=:buddyUserId, removed_by_buddy=false)` が存在する dive に限定 |
| `buddyName` | `dive_log_buddies.buddy_name ILIKE %:buddyName%`（`removed_by_buddy=false`）が存在する dive に限定 |
| 権限 | 検索対象は本人ログのみ（`fetchDiveListPage` が `user_id=self` を固定。公開ログは検索対象外）（FR-023） |

実装は `dive_id in (select dive_id from dive_log_buddies where ...)` のサブクエリ、または inner join + distinct。除去済みタグ（`removed_by_buddy=true`）はヒットさせない。

## 既存ユーティリティの更新

- `parseDiveFilter`: `buddy` / `buddy_name` を追加パース（uuid 検証・長さ丸め）
- `filterToSearchParams`: 上記 2 つを URL へ反映（空は省略）
- `FILTER_KEYS` / `isSameFilter`: 新フィールド 2 つを追加

## 受け入れ基準（spec 対応）

- FR-022（バディ絞り込み追加）/ FR-023（閲覧権限のあるログのみ）/ SC-006（1 秒以内）
