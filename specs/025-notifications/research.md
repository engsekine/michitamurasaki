# Phase 0 Research: 通知機能（アプリ内通知）

Technical Context の未確定点を解決する。各項目は Decision / Rationale / Alternatives の形式で記録する。

## 1. ソーシャル通知（フォロー / バディタグ）の生成方式

- **Decision**: `user_follows` と `dive_log_buddies` の INSERT に **AFTER トリガー**（security definer + `set search_path = ''`）を張り、DB 側で `notifications` に upsert する。
- **Rationale**: Server Action 内で生成すると PostgREST 直叩き（anon キー + 認証セッションでの直接 API 呼び出し）のイベントを取りこぼす。本プロジェクトは 2026-07 の全仕様監査以降「アプリ層は防御の一層、真実は DB 側」の方針で統一されており（バディの UPDATE ガードトリガー等）、通知の生成漏れ防止も同じ位置に置くのが一貫する。preferences チェック・自己通知防止・集約 upsert をトリガー内で完結できる。
- **Alternatives considered**: Server Action 内で生成（直 API 経路を取りこぼす）／ Supabase Webhooks + Edge Functions（インフラ・デプロイ対象が増える。通知はトランザクション内で作れる方が単純）。

## 2. リマインド通知（予定日当日 / OH 期限）の生成方式

- **Decision**: **アクセス時の遅延生成（lazy generation）**。TOP ダッシュボードと通知一覧ページの表示時に `ensureTimedNotifications()` を実行し、本人の「予定日 = JST 今日の予定」「OH 期限到来の機材」を冪等に upsert する。
- **Rationale**: v1 はアプリ内通知のみで、開かない限り通知は見えない。ならば「開いた瞬間に生成」で機能要件（FR-009/010 の 1 回だけ）を満たせ、cron / スケジューラ基盤が不要。OH 期限日の計算（`lastOverhauledOn + intervalMonths`、存在しない日は月末丸め）は既存 `features/dashboard/lib/overhaul.ts` に実装済みで、SQL に複製すると月末丸めロジックが二重管理になるため app 層生成が適切。「1 回だけ」は unique 制約（受信者 × 種別 × 対象 × 期限日）で DB が保証する。
- **Alternatives considered**: pg_cron（Supabase で利用可能だが、本人が開くまで見えない通知を先行生成する意味がなく運用対象が増える）／ scheduled Edge Function（同上）。メール通知を将来追加する際に push 型生成（cron）への移行を再検討する。

## 3. 集約（FR-008）と既読維持（Clarification Q3）の実現

- **Decision**: 通知の同一性を **式 unique インデックス**（`recipient_id, type, coalesce(actor_id::text,''), coalesce(resource_id::text,''), dedup_key`）で定義し、`insert ... on conflict do update set occurred_at = now()` で集約する。`read_at` は on conflict で触らない（既読維持）。
- **Rationale**: フォロー解除→再フォロー連打で行が増えない（スパム防止）ことと「既読は未読に復活しない」を、アプリロジックではなく制約 + upsert の性質だけで保証できる。`dedup_key` はリマインドの「期限日」を入れて年をまたぐ再発生（別の予定日・別の OH 期限）を別通知として扱う。ソーシャル通知は空文字固定。
- **Alternatives considered**: 発生ごとに行を挿入し表示時に集約（既読管理が複雑化・行数が際限なく増える）／ 部分 unique インデックスを種別ごとに複数定義（列が nullable のため coalesce 式 1 本の方が単純）。

## 4. 未読バッジの取得

- **Decision**: `AuthNav`（全認証ページの Header に渡る）内の Server Component `NotificationBell` で `count` クエリを実行。部分インデックス `on notifications (recipient_id) where read_at is null` を張る。10 件以上は「9+」。
- **Rationale**: リアルタイム配信を要求しない（spec Assumption）ため、ページ描画時の count 1 本で SC-001（次回画面表示で反映）を満たせる。部分インデックスにより行数が増えてもコストは未読数に比例。
- **Alternatives considered**: Supabase Realtime（要件外・接続管理が増える）／ クライアントポーリング（不要なリクエスト増）。

## 5. 保持期間 90 日（FR-013）の実現

- **Decision**: `ensureTimedNotifications()` 内で本人の `occurred_at < now() - interval '90 days'` の通知を削除する（遅延クリーンアップ）。
- **Rationale**: cron を持たない方針（Decision 2）と揃える。アクセスしないユーザーの通知が 90 日を超えて残ることは許容（本人以外は読めないため実害なし。FR-013 は「削除してよい」の許可規定）。
- **Alternatives considered**: pg_cron による一括削除（インフラ追加。将来データ量が問題になれば移行）。

## 6. 通知設定（FR-011）のデータ形

- **Decision**: `notification_preferences(user_id, type, is_enabled)`、主キー `(user_id, type)`。**行が存在しない = ON（既定）**。OFF にしたときに行を upsert する。
- **Rationale**: 既定 ON を「行なし」で表現すると、既存全ユーザーへのバックフィルが不要で、種別追加時も既定 ON が自動で成立する。トリガー（ソーシャル）と app 層（リマインド）の双方から `not exists (... is_enabled = false)` の同一条件で参照できる。
- **Alternatives considered**: ユーザー行に boolean 列を 4 つ持つ（種別追加のたびに ALTER が必要・3NF 違反気味）／ jsonb 設定（CHECK で守れない）。

## 7. 通知からの遷移先解決と消滅時フォールバック（FR-012）

- **Decision**: 遷移先は表示時に種別から静的に組み立てる（`followed` → プロフィール URL（034 以降は actor のユーザー ID の URL・未取得時は内部 ID フォールバック）、`buddy_tagged` → `/dives/[resource_id]`、`plan_reminder` → `/plans/[resource_id]`、`overhaul_reminder` → `/settings/equipment`）。対象が消えている場合は各遷移先ページの既存 404 / フォールバック（`notFound()` や一覧リダイレクト）に委ね、通知一覧側では事前の存在チェックをしない。
- **Rationale**: 一覧表示のたびに対象の存在確認 JOIN を行うとコストが高い。既存ページは削除・非公開化に対して適切な 404 / 案内を既に持っており（021/024 で検証済み）、通知はそこへ委譲すれば FR-012 の「エラー画面にしない」を満たせる。actor 退会時は `actor_id` が `on delete set null` になるため、一覧側で「退会したユーザー」表示 + 遷移無効化を行う。
- **Alternatives considered**: 一覧クエリで対象テーブルへ LEFT JOIN して存在フラグを返す（クエリ複雑化。v1 では過剰）。

## 8. 表示名の解決

- **Decision**: ソーシャル通知の「〇〇さん」は、021 で導入済みの `get_user_public_profiles`（nickname のみ返す definer 関数）を再利用して表示時に解決する。通知行にニックネームを複製保存しない。
- **Rationale**: 3NF（ニックネーム変更が通知に自動反映）。タイムライン（021）と同じ解決パターンで実装コストが低い。
- **Alternatives considered**: 通知行に表示名をスナップショット保存（改名が反映されない・非正規化の理由が弱い）。

## 未解決（NEEDS CLARIFICATION 残なし）

Phase 0 ですべての技術未確定点を解決済み。
