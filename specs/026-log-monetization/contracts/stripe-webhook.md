# Contract: Stripe Webhook（026）

配置: `service-front/src/app/api/stripe/webhook/route.ts`（POST のみ）。Stripe からのサーバー間通知を受け、**枠付与の唯一のトリガー**となる（FR-007: 決済完了前の付与禁止）。

## 共通要件

- **署名検証必須**: `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`。検証失敗は 400 を返し本文を処理しない
- **Supabase クライアント**: service_role を使用（ユーザーセッションが存在しないため）。service_role キーはこの route と server 専用モジュールの外に出さない
- **応答規約**: 処理成功・冪等 no-op は 200。一時的失敗（DB 接続断等）は 500 を返し Stripe の自動リトライに委ねる。未対応イベント種別は 200（無視）
- **ドメイン処理の分離**: イベント→付与のロジックは `features/credits/lib/stripe/` の pure に近い関数へ切り出し、route は「検証 + 委譲」のみ（Vitest はドメイン関数を直接テスト）

## checkout.session.completed

1. `session.id` で `log_credit_purchases` を検索
   - 見つからない場合: `client_reference_id` と session 情報から購入レコードを補完作成（Server Action 側の作成失敗に対する自己修復）
2. `credited_at is not null` なら **no-op で 200**（冪等 / US2-AC3）
3. `payment_status = 'paid'` を確認（未払いなら no-op 200）
4. トランザクション相当の RPC `complete_purchase(session_id)` を呼ぶ:
   - purchases を `status='completed'`, `credited_at=now()`, `stripe_payment_intent_id` 更新
   - `apply_credit_ledger_entry(user_id, 'purchase', +quantity, purchase_id)` で付与
   - `credited_at` の条件付き更新（`where credited_at is null`）で同時実行でも 1 回のみ付与

## charge.refunded

1. `payment_intent` から該当 purchase を特定。無ければ no-op 200（本機能外の決済）
2. RPC `apply_refund(purchase_id, refund_id)` を呼ぶ:
   - `stripe_refund_id` ユニークで重複調整を防止（重複時 no-op）
   - 調整量 = `min(付与数, 現在残高)` を負値で ledger へ（残高は 0 で床打ち / spec Edge Case）
   - purchases を `status='refunded'` へ更新

## 決済失敗（checkout.session.expired / async_payment_failed）

- purchases を `status='failed'` へ更新するのみ。枠は付与しない（US2-AC2）
- ユーザーへの失敗表示は Stripe Checkout 画面と `cancel_url` 戻りの画面表示で行う（webhook はユーザー通知を持たない）

## 環境変数

| 変数 | 用途 | 置き場所 |
|------|------|----------|
| STRIPE_SECRET_KEY | Session 作成・SDK 初期化 | service-front の env（Vercel 等）。ローカルは service-front/.env |
| STRIPE_WEBHOOK_SECRET | 署名検証 | 同上（ローカルは `stripe listen` が発行する値） |
| SUPABASE_SERVICE_ROLE_KEY | webhook の付与処理（service_role クライアント） | 同上。無いと署名検証後に 500（Stripe がリトライし続ける） |

## 検証（quickstart 参照）

ローカルは Stripe CLI + テストカード `4242...` で E2E 確認（dev サーバーが HTTPS の場合は `--forward-to https://localhost:3000/api/stripe/webhook --skip-verify`）。`stripe events resend` の重複送信で二重付与が起きないことを必ず確認する。手順の詳細は service-front/README.md の「Stripe の設定」を参照。
