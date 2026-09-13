# Quickstart: ログ枠の有料化（026）検証手順

実装完了後に E2E で機能を検証する手順。契約の詳細は [contracts/](contracts/)、スキーマは [data-model.md](data-model.md) を参照。

## 前提

```bash
supabase start                     # ローカル Supabase（migrations + seed 適用済み）
npm run dev --workspace service-front

# Stripe（テストモード）
stripe login
# dev サーバーのスキームに合わせる（make dev-https なら https + --skip-verify）
stripe listen --forward-to https://localhost:3000/api/stripe/webhook --skip-verify
# 出力された whsec_... を service-front/.env の STRIPE_WEBHOOK_SECRET へ
# STRIPE_SECRET_KEY（sk_test_...）と SUPABASE_SERVICE_ROLE_KEY（supabase status の値）も同ファイルに設定
```

seed のテストユーザー（`supabase/.env` の TEST_USER_EMAIL / PASSWORD）でログインする。

## 1. 初期枠とデイリーボーナス（US1 / FR-003・008）

1. 新規ユーザーを登録 → `/settings/log-credits` で残枠 **10** を確認（FR-008）
2. 翌日扱いの検証: DB で該当ユーザーの `daily_bonus` ledger の `granted_on` を前日に更新 → 任意の認証ページを再訪問 → 残枠が +1（FR-003）
3. 同日中にページを何度リロードしても残枠が増えないこと（冪等）

```sql
-- 突合（FR-016 / SC-004）: 0 行であること
select b.user_id, b.balance, coalesce(sum(l.amount), 0) as ledger_sum
from public.log_credit_balances b
left join public.log_credit_ledger l on l.user_id = b.user_id
group by b.user_id, b.balance
having b.balance <> coalesce(sum(l.amount), 0);
```

## 2. 枠の消費とブロック（US1 / FR-001・002）

1. ログを新規作成 → 残枠が 1 減る（US1-AC1）
2. DB で残高を 0 に調整（消費 ledger を手で積むか、残枠分ログを作成）
3. ログ新規作成を試行 → 作成されず、`role="alert"` の案内（ボーナス説明 + 購入導線）が表示される（US1-AC2）
4. 予定→ログ移動（024 の導線）でも同様に消費・ブロックされること（FR-012）
5. 既存ログの閲覧・編集・削除が残枠 0 でも行えること（FR-009/010）。削除で残枠が増えないこと（FR-011）

**同時実行**: 残枠 1 の状態で `createDive` を並行 2 発 → 成功は 1 件のみ、残高 0・マイナスにならない（Edge Case）

セクション 1・2 の DB レベルの検証は統合テストで自動化済み:

```bash
cd service-front
SUPABASE_DB_TESTS=1 npx vitest run --project=unit src/features/credits/server/creditRules.test.ts
```

## 3. 購入フロー（US2 / FR-005・006・007）

1. `/settings/log-credits` →「ログパックを購入」→ Stripe Checkout でテストカード `4242 4242 4242 4242` で支払い
2. success で戻る → 「反映まで最大 1 分」の通知 → リロードで残枠 +10（US2-AC1 / SC-002・003）
3. 購入履歴に日時・「ログ枠 {枠数}」・購入時の金額・完了 が表示される（FR-014）
4. **冪等性**: `stripe events resend <event_id>`（または `stripe trigger checkout.session.completed` の再送）→ 残枠が増えないこと（US2-AC3）
5. **失敗系**: テストカード `4000 0000 0000 0002`（決済拒否）→ 枠が付与されず、Checkout 上で失敗が表示される（US2-AC2）
6. **キャンセル**: Checkout で戻るボタン → `checkout=cancelled` の通知、枠は変化なし

## 4. 返金（Edge Case）

1. Stripe ダッシュボード（テスト）で購入を返金 → `charge.refunded` が届く
2. 未消費なら残枠 −10、購入履歴が「返金済み」になる
3. 残高が 10 未満のとき: 残高が 0 で床打ちされ、マイナスにならないこと

## 5. 回帰確認

- 022 以前の既存機能: ログ編集・エクスポート（014）・タイムライン（021）が枠と無関係に動くこと
- `npx biome check .` / Vitest / Playwright a11y（新規ページ・バナー）がすべて通ること
- アプリ内に広告表示が存在しないこと（FR-015 は「実装しない」ことの確認）
