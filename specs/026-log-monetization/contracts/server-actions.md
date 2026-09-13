# Contract: Server Actions / Queries（026）

配置: `service-front/src/features/credits/server/`。すべて認証必須（`auth.getUser()` で本人確認、未認証は失敗を返す）。

## createCheckoutSession(packId) → { url: string } | { error: CreditsErrorCode }

購入フローの起点（Server Action）。

- **入力**: `packId: string`（`LOG_CREDIT_PACKS` の id: `trial` / `standard` / `bulk`）。金額・数量はクライアントから一切受け取らず、packId をサーバー定数で検証して解決する（未知の packId は失敗を返す）
- **処理**:
  1. `features/credits/constants.ts` の `LOG_CREDIT_PACKS`（お試し 10 枠 480 円 / おすすめ 30 枠 1,200 円 / たっぷり 100 枠 3,000 円）から `findLogCreditPack(packId)` で解決
  2. Stripe Checkout Session を作成: `mode: 'payment'`、`currency: 'jpy'`、`line_items` は `price_data` インライン、`client_reference_id: user.id`、`metadata: { pack_id }`（webhook のパック判別用）、`success_url: /settings/log-credits?checkout=success&session_id={CHECKOUT_SESSION_ID}`、`cancel_url: /settings/log-credits?checkout=cancelled`
  3. `create_pending_purchase(session_id, quantity, amount_jpy)`（security definer RPC）で `status='pending'` の購入レコードを作成
  4. Checkout の `url` を返し、クライアントはフルページリダイレクト
- **失敗系**: Stripe API エラー → `{ error: 'checkout_failed' }`（画面は再試行案内 / US2-AC2）。purchase レコード作成失敗 → セッションは破棄扱いで同エラー
- **冪等性**: 多重クリックで pending が複数できても、付与は session 単位（webhook）でしか起きないため実害なし。未完了 pending は履歴に表示しない

## getCreditBalance() → number

- `log_credit_balances` から本人残高を 1 行 select（RLS で本人に限定）。行が無い場合は 0
- 利用箇所: 残枠バッジ（ヘッダー / ログ作成導線）、`/settings/log-credits`、DiveForm の残枠 0 判定

## getPurchaseHistory() → Purchase[]

- `log_credit_purchases` を本人・`created_at desc` で取得。`status='pending'` は除外し、`completed` / `refunded` を表示（FR-014）
- 返却: `{ id, quantity, amountJpy, status, purchasedAt }[]`

## grant_daily_bonus（RPC・参考）

Server Action ではなく `app/(authenticated)/layout.tsx` から `supabase.rpc('grant_daily_bonus')` で呼ぶ。

- 戻り値: なし（void）。残高表示は `getCreditBalance()` が担う
- 失敗時: レイアウトを落とさない（catch してログのみ。ボーナスは次回訪問で回復する）

## createDive / createDiveFromPlan（既存・変更）

- insert が detail `no_credit`（残枠不足トリガー・P0001）で失敗した場合、`{ error: 'no_credit' }` を返す
- `useDiveFormSubmit` は `no_credit` を受けて `role="alert"` の案内（デイリーボーナス説明 + `/settings/log-credits` への導線）を表示（FR-002 / US1-AC2）
- それ以外の入出力は 002 / 024 の既存契約から変更しない
