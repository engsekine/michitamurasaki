# Quickstart / 検証ガイド: 通知機能（アプリ内通知）

トリガー・RLS を含むためユニットテストだけでは完結しない。以下の手動シナリオで end-to-end を検証する。詳細は [contracts/](./contracts/) と [data-model.md](./data-model.md) を参照。

## 前提

- `supabase db reset` 済みのローカルスタック + `npm run dev`（service-front）
- テストユーザー 2 名（A / B）。B は A をフォローできる状態（サインアップ・プロフィール補完済み）

## シナリオ 1: ソーシャル通知（US1）

1. B でログインし、A をフォロー → A のログに（A の操作で）B をバディタグできる公開ログを用意
2. A でログイン → ヘッダーのベルに未読バッジ「1」（フォロー通知）
3. `/notifications` を開く → 「B さんにフォローされました」が新しい順で表示。**一覧を開いただけでは未読のまま**（バッジ変化なし）
4. 通知をタップ → B のプロフィールへ遷移し、戻るとその通知だけ既読・バッジ減
5. B が A をフォロー解除 → 再フォローを 3 回繰り返す → A の通知は 1 件のまま増えない。手順 4 で既読にしていた場合、**未読に戻らない**（日時のみ更新）
6. B が自分の公開ログに A をバディタグ → A に「B さんのログにバディとして追加されました」→ タップでログ詳細へ
7. 未読を複数作り「すべて既読にする」→ 一覧・バッジが即時反映、リロード後も維持
8. 通知 0 件のユーザーで `/notifications` → 「通知はありません」

## シナリオ 2: リマインド通知（US2）

1. A で予定日 = 今日のダイビング予定を作成 → TOP または `/notifications` を開くと「今日はダイビング予定日です」が 1 件生成される。再読み込みしても増えない（1 回だけ / FR-009）
2. 過去日（昨日以前）の予定を新規作成 → リマインドは生成されない
3. レギュレーターの OH 期限が今日以前になるよう登録（例: 前回 OH 13 ヶ月前・周期 12 ヶ月）→ 「OH 期限が到来しました」が 1 件生成。タップで `/settings/equipment` へ
4. 予定リマインドの通知から、予定をログへ移動した後に同じ通知をタップ → エラー画面にならず適切に案内される（FR-012）

## シナリオ 3: 通知設定（US3）

1. A の `/settings/notifications` でフォロー通知を OFF
2. B がフォロー解除 → 再フォロー → A に新しい通知が**生成されない**（既存通知の日時も更新されない）
3. OFF のあいだに C（第三のユーザー）が A をフォロー → 通知なし。その後 A が ON に戻す → C のフォロー通知は**遡って生成されない**（FR-011）
4. ON に戻した後、B が再フォロー → 通知が届く

## シナリオ 4: セキュリティ（FR-014 / SC-005）

anon キー + A のアクセストークンで PostgREST を直叩きし、以下がすべて拒否（0 行 / エラー）されることを確認:

```bash
# 他人（B）の通知の閲覧 → 0 行
curl "$SUPABASE_URL/rest/v1/notifications?recipient_id=eq.$B_ID" -H "apikey: $ANON" -H "Authorization: Bearer $A_TOKEN"

# 他人宛の通知の偽造 INSERT → RLS 違反
curl -X POST "$SUPABASE_URL/rest/v1/notifications" ... -d '{"recipient_id":"'$B_ID'","type":"followed"}'

# 自分の通知の read_at 以外の改ざん（type 変更等）→ ガードトリガーで例外
curl -X PATCH "$SUPABASE_URL/rest/v1/notifications?id=eq.$NOTIF_ID" ... -d '{"type":"plan_reminder"}'
```

## 自動テスト

- `npx vitest run src/features/notifications`（クエリ・アクション・判定ロジック・コンポーネント）
- `supabase db lint`（関数 lint）と CI の db-lint ジョブ
- Playwright a11y（通知一覧・設定ページ）

## 完了判定

- SC-001（次回表示でバッジ反映）・SC-002（2 操作で対象到達）・SC-003（既読の即時反映と永続）・SC-005（他人の通知 0 件）・SC-006（OFF 種別の生成 0 件）を上記シナリオで確認できること
