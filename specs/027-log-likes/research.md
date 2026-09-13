# Research: ログのいいね機能

**Date**: 2026-07-04 | **Feature**: [spec.md](./spec.md)

Technical Context に NEEDS CLARIFICATION は残っていない。以下は設計上の分岐点の決定記録。

## R1. いいねの保存方式

**Decision**: `dive_likes (user_id, dive_id, created_at)` の 1 テーブル。`(user_id, dive_id)` を複合 PK とし、件数は都度 `count` で集計する（非正規化カラムを持たない）。

**Rationale**:
- 複合 PK が「同一利用者 × 同一ログは 1 件まで」（FR-003）をアプリコードに依存せず担保する。連打・二重送信は一意制約違反となり、Server Action 側で冪等成功に変換できる（`followUser` の既存パターンと同一）
- いいね一覧（FR-007）は `created_at` の降順で PK 行をそのまま並べれば得られる
- sql.md「計算可能な値を冗長に保存しない」に従う。初期規模ではタイムライン 20 件分の件数集計は `dive_id in (...)` の 1 クエリで十分軽い

**Alternatives considered**:
- `dives.likes_count` の非正規化カラム + トリガー同期 → 集計クエリが性能問題になってから検討すべき早すぎる最適化。整合性維持のトリガーが増える割に現規模で利益がない
- 履歴保持（取り消しを論理削除で残す）→ spec Assumption で「履歴は保持しない」と確定済み。物理削除が最も単純

## R2. 公開範囲・自己いいね禁止の防御位置

**Decision**: RLS の INSERT ポリシー `with check` で「`user_id = auth.uid()` かつ 対象ログが公開中（`is_public and deleted_at is null`）かつ 他人のログ（`d.user_id <> auth.uid()`）」を強制する。UI 非表示（自分のログにはボタンを出さない）と Server Action の事前チェックを重ねた三重防御。

**Rationale**:
- PostgREST 直叩きを含む全経路で FR-006（自己いいね拒否）と FR-014（公開範囲準拠）が破れない。021 で確立した「UI + Server Action + RLS の三重防御」方針と一致
- 021 の `prevent_self_buddy` はトリガーで実装したが、いいねは「行の所有者 = 操作者」なので RLS の `with check` だけで表現でき、トリガーより宣言的で監査しやすい

**Alternatives considered**:
- BEFORE INSERT トリガーでの拒否（`prevent_self_buddy` 同型）→ RLS で表現可能な条件にトリガーを足すのは冗長。ポリシー違反は 42501 として一様に扱える
- Server Action のみの防御 → RLS を素通りする経路（anon キー直叩き）を塞げないため不採用

## R3. いいね通知の生成方式

**Decision**: `dive_likes` の INSERT に AFTER トリガー `notify_on_like()` を張り、DB 側で `log_liked` 通知を upsert する。025 の `notify_on_follow` / `notify_on_buddy_tag` と同一パターン（security definer + `set search_path = ''` + `notification_preferences` 参照 + 集約キーで upsert + `read_at` 維持）。

**Rationale**:
- 通知の発生源が DB 書き込みそのものであり、どの経路からいいねされても漏れない（025 research の決定と同じ根拠）
- 「同一の いいねした人 × ログ は最新 1 件に集約・既読は未読に戻さない」（FR-011）は 025 で実装済みの `on conflict ... do update set occurred_at = now()`（`read_at` 非更新）がそのまま使える
- 通知設定 OFF 時にトリガー内で生成をスキップする仕組み（FR-012）も既存トリガーと同一

**Alternatives considered**:
- Server Action 内で通知 INSERT → いいねと通知の書き込みがアトミックにならず、経路の追加（将来の API 等）で漏れる。025 で不採用にした案の再来
- 取り消し時に通知も削除する → 025 の方針（通知はイベントの記録。フォロー解除でも通知は消さない）と揃え、削除しない。再いいね時は既存行の `occurred_at` のみ更新

## R4. `log_liked` 種別の追加方法

**Decision**: `notifications.type` / `notification_preferences.type` の CHECK 制約を drop → 再作成で `'log_liked'` を追加する 1 マイグレーション。`actor_id` = いいねした人、`resource_id` = 対象ログ ID を使い、テーブル構造は変更しない。

**Rationale**:
- 025 のデータモデルは種別追加を想定して `type text + CHECK` を採用済み（enum を避けた理由がまさにこれ）。CHECK の再作成は既存行に影響しない
- 通知設定は「行なし = ON」の設計なので、既存ユーザーへのデータ移行は不要（既定 ON が自動で成立 = spec Key Entities）

**Alternatives considered**:
- 種別ごとの通知テーブル分割 → 025 の一覧・未読・既読基盤が使えなくなる。不採用

## R5. いいね一覧の取得と表示

**Decision**: `/likes` ページで `dive_likes` を起点に `dives` を JOIN し、`dive_likes.created_at` 降順の keyset ページング（20 件/頁）で取得する。表示は既存 `TimelineItem` 型に変換してタイムラインと同じカード表現を再利用する。

**Rationale**:
- JOIN 先の `dives` は RLS で「公開中 or 本人」しか見えないため、非公開化・削除されたログが一覧から自動的に消える（FR-009）。アプリ側の除外ロジックが不要
- keyset ページングは 021 タイムライン・025 通知一覧で確立済み。SC-005（100 件超でも初期表示が劣化しない）を満たす
- `TimelineItem` の再利用で、公開ログの見た目・遷移（`/dives/[id]`）が全画面で一貫する

**Alternatives considered**:
- offset ページング → 大量データで遅くなる既知の問題。既存方針とも不一致
- 専用のカードコンポーネント新設 → 見た目の一貫性が崩れ、テスト・story の重複が増える。不採用

## R6. コード配置（feature の切り方）

**Decision**: 新 feature は切らず `features/social/` に追加する（LikeButton / likeDive / unlikeDive / fetchLikedDives / タブ導線）。`DiveDetail`（features/dives）へは `likeAction?: ReactNode` スロットを追加し、app 層で `LikeButton` を注入する。

**Rationale**:
- いいねはフォロー・タイムラインと同じ「公開ログに対するソーシャル操作」で、タイムライン（social 所管）への組み込みが最も深い。social に置けば cross-feature import が発生しない
- DiveDetail への直接 import（dives → social）は Feature-based の依存方向を乱す。スロット化なら `app/` → `features/` の合成で解決し、DiveDetail は「アクション領域に何かを置ける」だけの汎用変更で済む

**Alternatives considered**:
- 新 feature `features/likes/` → Timeline への組み込みで social → likes の cross-feature import が発生し本末転倒。通知（025）が独立 feature なのは複数 feature を横断するためで、いいねは social に内包される
- `shared/` に LikeButton を置く → ドメイン知識（dive・Server Action）を持つため shared の条件を満たさない

## R7. タイムライン・ログ詳細への件数と状態の供給

**Decision**: `fetchTimeline` / ログ詳細のクエリを拡張し、表示対象の dive ID 群に対して「件数（group by dive_id の count）」と「自分がいいね済みか（`user_id = auth.uid()` の in 検索）」をバッチ取得して `TimelineItem` に載せる。

**Rationale**: 項目ごとの個別クエリ（N+1）を避ける。20 件 × 2 情報でも追加クエリは 1〜2 本で済む

**Alternatives considered**: dive ごとのビュー / RPC 関数化 → クエリ 2 本で足りる規模では過剰。必要になったら集計ビューに移せる（sql.md の非正規化ルールに従いコメントで理由を残す）
