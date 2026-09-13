# Phase 0 Research: バディ・フォロー・タイムライン

spec の [NEEDS CLARIFICATION] は specify フェーズで解消済み（公開範囲＝リンク＋フォロワー / フォロー＝承認不要一方向 / バディタグ＝本人除去可）。本書では実装上の技術論点を決定する。

## R1. 既存フリーテキストバディ（`dives.buddy_name`）の移行方針

- **Decision**: `dives.buddy_name` は**残置し、表示時にフリーテキストバディとして併存表示**する。新規/編集入力はすべて中間テーブル `dive_log_buddies` に保存する。`buddy_name` の一括移行（バックフィル）は本フェーズでは行わない。
- **Rationale**: 既存データを壊さず段階移行できる。バックフィルは「複数名カンマ区切り」など表記が不定で機械分割が危険なため、ユーザーが編集時に自然に中間テーブルへ移す方式が安全。1NF 違反を新規データで作らないことを優先（rules/sql.md）。
- **Alternatives considered**: (a) 起動時バックフィル → 表記ゆれで誤分割リスク。(b) `buddy_name` 廃止 → 既存ログの情報欠落。いずれも却下。

## R2. 公開ログの匿名アクセス手段（共有リンク）

- **Decision**: 認証ユーザーの閲覧は `dives` の RLS（`to authenticated using (is_public = true)`）で許可。**匿名（未ログイン）からの共有ページは、テーブル RLS を anon に広げず `get_public_dive(slug)`（SECURITY DEFINER, `set search_path = ''`）で公開ログ 1 件のみ返す**。
- **Rationale**: anon に対して `dives` 全体の select を開くと、他の公開ログの列挙や将来の公開条件変更時の事故リスクが上がる。slug 指定で 1 件だけ返す関数なら攻撃面が最小（SC-002）。関数は `is_public = true` の行のみ返し、必要列だけを射影する。
- **Alternatives considered**: anon 向け RLS ポリシー追加 → 列挙耐性が下がるため却下。共有を認証必須にする → 「リンクを知る全員」という確定仕様に反するため却下。

## R3. タイムラインのページング方式

- **Decision**: 既存ダイブ一覧と同じ**キーセットページネーション（`(dive_date desc, id desc)` 複合カーソル）** を採用。初期 20 件（SC-004）、続きは「もっと見る」。
- **Rationale**: OFFSET 方式はフォロー数・公開ログ増加で劣化する。既存 `list-query.ts` のカーソル方式と実装・テスト資産を共有できる。
- **Alternatives considered**: OFFSET ページング → 大量データで性能劣化、却下。全件取得 → SC-004 を満たせず却下。

## R4. フォロー状態・件数取得の最適化

- **Decision**: プロフィール表示時に「対象ユーザーのフォロワー数 / フォロー数 / 自分がフォロー中か」を**集約クエリでまとめて取得**。タイムライン用の「自分がフォロー中の followee_id 集合」はサブクエリ（`user_id in (select followee_id from user_follows where follower_id = (select auth.uid()))`）で `dives` 取得に内包する。
- **Rationale**: N+1 を避け、SC-003（3 秒以内反映）を満たす。`idx_user_follows_followee` でフォロワー集計、PK 前方一致でフォロー集計が効く。
- **Alternatives considered**: 件数の非正規化キャッシュ列 → 整合トリガが必要で過剰（中規模スケール）。将来必要時に導入。

## R5. 自己バディ防止（buddy_user_id = ログ所有者）の実装場所

- **Decision**: **DB トリガ（BEFORE INSERT/UPDATE, `set search_path = ''`）** で `buddy_user_id` が当該 `dive` の所有者と一致する場合に例外を送出。加えて Server Action / yup でも事前チェック（UX 向上）。
- **Rationale**: CHECK 制約は他テーブル（dives.user_id）を参照できないためトリガが必要。一次防御を DB に置く（constitution IV）。
- **Alternatives considered**: アプリ層のみ → 直叩きで回避され得るため却下。

## R6. バディ「本人除去」と再タグ付けブロック（FR-024a/b）

- **Decision**: 中間行に `removed_by_buddy boolean` を持つ**ソフト除去**。本人は自分宛行の `removed_by_buddy=true` を UPDATE 可。所有者の DELETE ポリシーは `removed_by_buddy=false` の行のみ対象とし、ソフト除去行は残置。`(dive_id, buddy_user_id)` 部分ユニークにより同一相手の再 INSERT を不可にする。
- **Rationale**: 「本人除去が優先・再タグ付けブロック」（FR-024b）を、別テーブルを増やさず満たせる。表示は `removed_by_buddy=false` のみ。
- **Alternatives considered**: 物理削除 → 所有者が削除→再追加で本人の意思を上書きできてしまうため却下。グローバル opt-out テーブル → 過剰。

## R7. 公開プロフィール／ユーザー識別子

- **Decision**: プロフィール URL は `/users/[id]`（`users.id` = `auth.users.id`）。表示名は `user_details.nickname`。プロフィールは公開ログ一覧・フォロー件数・フォローボタンを表示。
- **Rationale**: 既存の id 体系をそのまま使え、追加の slug 管理が不要。`user_details` は 016/diver-type 等と同様に nickname を表示名として一貫利用。
- **Alternatives considered**: ユーザー別 public slug → 管理コスト増、本フェーズ不要。

## まとめ（決定事項一覧）

| # | 論点 | 決定 |
|---|---|---|
| R1 | buddy_name 移行 | 残置・併存表示、新規は中間テーブル、バックフィルなし |
| R2 | 匿名共有 | `get_public_dive(slug)` SECURITY DEFINER、anon RLS は広げない |
| R3 | タイムライン ページング | キーセット（dive_date desc, id desc）20 件 + 続き |
| R4 | フォロー件数/状態 | 集約クエリ + サブクエリ内包、非正規化キャッシュは不採用 |
| R5 | 自己バディ防止 | DB トリガ（一次）+ アプリ事前チェック |
| R6 | 本人除去 | `removed_by_buddy` ソフト除去 + 部分ユニークで再タグ防止 |
| R7 | プロフィール | `/users/[id]`、表示名は nickname |

すべての NEEDS CLARIFICATION は解消済み。Phase 1 へ進む。
