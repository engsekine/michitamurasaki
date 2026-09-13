# Tasks: ログ枠の有料化（デイリーボーナス + 買い切りログパック）

**Input**: Design documents from `/specs/026-log-monetization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: constitution III（Test-First）に従い必須。DB 関数・Server Action・webhook ドメイン処理は実装前にテストを書き、コンポーネントは `/generate-with-tests` で test/story/a11y を同梱する。

**Organization**: ユーザーストーリー単位でフェーズ分割（US1: 枠消費+デイリーボーナス / US2: 購入 / US3: 可視化+履歴）。

**マイグレーションのタイムスタンプ**: `<ts>` は作成時点の `YYYYMMDDHHMMSS` に置き換える（例: `20260703100000`）。既存最新（`20260702150100`）より後であること。

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 依存パッケージ・環境変数・feature スケルトンの準備

- [X] T001 `service-front` に `stripe`（サーバー SDK）を追加し、`service-front/package.json` に反映する（`npm i stripe --workspace service-front`）
- [X] T002 [P] `service-front/.env.local.example`（無ければ新規）に `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` を追記し、取得方法のコメントを添える（contracts/stripe-webhook.md 環境変数表）
- [X] T003 [P] `service-front/src/features/credits/constants.ts` を新規作成し、`LOG_CREDIT_PACK = { quantity: 10, amountJpy: 300 }`・残枠不足判別用 `NO_CREDIT_ERROR_DETAIL = 'no_credit'`・日次ボーナス量 `DAILY_BONUS_AMOUNT = 1`・初期枠 `INITIAL_GRANT_AMOUNT = 10` を定義する（research.md 7）
- [X] T004 [P] `service-front/src/features/credits/types.ts` を新規作成し、`CreditBalance` / `CreditLedgerKind` / `Purchase`（quantity, amountJpy, status, purchasedAt）型を定義する（data-model.md のテーブル定義に対応）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 枠管理の DB 基盤。**全ストーリーがこのスキーマに依存する**

**⚠️ CRITICAL**: このフェーズ完了までユーザーストーリーの実装を開始しない

- [X] T005 `supabase/migrations/<ts>_create_log_credits.sql` を新規作成する（data-model.md の全定義）:
  - `log_credit_purchases` → `log_credit_ledger` → `log_credit_balances` の順で create table（FK 依存順）。制約・部分ユニーク・インデックス・`comment on` を含める
  - `apply_credit_ledger_entry()` / `grant_daily_bonus()` / `consume_log_credit()`（+ `dives` への AFTER INSERT トリガー）を `set search_path = ''` で定義
  - **関数の execute 権限制御**（data-model.md の権限表どおり revoke → 必要ロールへのみ grant。`apply_credit_ledger_entry` はクライアント実行不可）
  - 3 テーブルの RLS 有効化 + 本人 select ポリシーのみ（書き込みポリシーなし）
  - 既存ユーザー全員への `initial_grant` +10 バックフィル DML
  - 残高キャッシュの非正規化理由コメント（sql.md 準拠）
- [X] T006 `supabase/migrations/<ts>_alter_handle_new_user_grant_initial_credits.sql` を新規作成し、既存 `handle_new_user` に `apply_credit_ledger_entry(new.id, 'initial_grant', 10)` を追加する（FR-008。T005 の後のタイムスタンプ）
- [X] T007 `supabase/seed.sql` を変更し、テストユーザーへ十分な枠（例: `purchase` 相当ではなく `initial_grant` の追加付与）を dives の seed **より前に** 投入する（consume トリガーで seed が失敗しないため / research.md 2）
- [X] T008 DB 統合テスト `service-front/src/features/credits/server/creditRules.test.ts` を新規作成する（**T005 の SQL を書く前にテストケースを固め、`supabase db reset` 後に実行**）:
  - 消費: dives insert で残高 −1 / ledger に consumption 行
  - 残高 0 での insert が detail = 'no_credit'（P0001）で失敗しログが作られない
  - 残高 1 への並行 insert 2 件で成功が 1 件のみ（Edge Case）
  - `grant_daily_bonus()` の同日 2 回呼び出しで +1 のみ（冪等）
  - ledger 合計と balance の一致（FR-016 / quickstart の突合クエリ）
- [X] T009 `service-front/src/features/credits/server/queries.ts` を新規作成し、`getCreditBalance()`（行なし = 0）を実装する（contracts/server-actions.md。全ストーリーが参照）
- [X] T010 [P] `supabase db reset` でマイグレーション + seed が通ることを確認し、T008 のテストがすべて green になるまで T005〜T007 を修正する

**Checkpoint**: 枠の付与・消費・冪等性が DB レベルで保証された状態

---

## Phase 3: User Story 1 - 無料ユーザーのログ枠とデイリーボーナス (Priority: P1) 🎯 MVP

**Goal**: ログ作成が枠を消費し、残枠 0 でブロック + 案内、訪問時デイリーボーナス自動付与

**Independent Test**: 購入機能なしで検証可能 — 残枠ありで作成 → −1、残枠 0 で作成不可 + 案内、日付が変わった初回訪問で +1（quickstart 1・2）

- [X] T011 [US1] `service-front/src/app/(authenticated)/layout.tsx` を変更し、`supabase.rpc('grant_daily_bonus')` を呼ぶ（失敗は catch してログのみ・レイアウトを落とさない / contracts/server-actions.md）
- [X] T012 [P] [US1] `service-front/src/features/credits/components/client/NoCreditBanner/` を新規作成する（NoCreditBanner.tsx + index.ts）。`role="alert"`・ボーナス説明・`/settings/log-credits` への購入導線リンクは `showPurchaseLink` prop で条件表示（US1 単独リリースでは無効 / contracts/ui.md の文言・a11y 契約）
- [X] T013 [US1] `/generate-with-tests service-front/src/features/credits/components/client/NoCreditBanner/NoCreditBanner.tsx` を実行し test / story / a11y テストを生成する
- [X] T014 [US1] `service-front/src/features/dives/server/actions.ts` を変更し、`createDive` / `createDiveFromPlan` の insert エラーで detail `no_credit`（P0001）を判別して `{ error: 'no_credit' }` を返す分岐を追加する（contracts/server-actions.md）
- [X] T015 [US1] `service-front/src/features/dives/hooks/useDiveFormSubmit.ts` を変更し、`no_credit` 受領時に NoCreditBanner 表示用の状態を返す。`useDiveFormSubmit.test.ts` に分岐テストを同期追加する
- [X] T016 [US1] `service-front/src/features/dives/components/client/DiveForm/DiveForm.tsx` を変更し、残枠 0 時の NoCreditBanner 表示（初期表示 + 送信エラー時、入力値保持）を追加する。`DiveForm.test.tsx` / `DiveForm.stories.tsx` を同期更新する（contracts/ui.md）
- [X] T017 [US1] `service-front/src/app/(authenticated)/dives/new/page.tsx` を変更し、`getCreditBalance()` で残枠を取得して DiveForm へ渡す（Server Component でフェッチ / 憲法 II）
- [ ] T018 [US1] quickstart.md セクション 1・2 を手動実行し、US1 の受け入れシナリオ 4 件（消費 / ブロック / ボーナス冪等 / 既存ログ非影響）を確認する

**Checkpoint**: 無料ユーザーの体験が完結（購入なしで毎日 1 ログ運用が成立）

---

## Phase 4: User Story 2 - ログパックの買い切り購入 (Priority: P2)

**Goal**: Stripe Checkout で 10 枠 300 円を購入 → webhook で冪等に付与

**Independent Test**: US1 完了状態で、購入完了 → 残枠 +10、決済失敗 → 付与なし、webhook 再送 → 二重付与なし（quickstart 3・4）

- [X] T019 [US2] `supabase/migrations/<ts>_add_purchase_functions.sql` を新規作成し、`create_pending_purchase()` / `complete_purchase()` / `apply_refund()` を定義する（contracts/stripe-webhook.md の冪等契約: `credited_at is null` 条件付き更新・`stripe_refund_id` ユニーク・返金は残高 0 で床打ち。execute 権限は data-model.md の権限表どおり）
- [X] T020 [P] [US2] `service-front/src/features/credits/lib/stripe/` を新規作成する（stripe.ts: SDK 初期化 + `fulfillCheckoutSession(session)` / `processRefund(charge)` ドメイン関数 + index.ts）。route から分離してテスト可能にする（contracts/stripe-webhook.md）
- [X] T021 [P] [US2] `service-front/src/features/credits/lib/stripe/stripe.test.ts` を**先に**作成する: 付与成功 / credited_at 済み no-op / 未払い no-op / purchase レコード補完作成 / 返金の床打ち・重複 no-op（Supabase・Stripe はモック）
- [X] T022 [US2] `service-front/src/features/credits/server/actions.ts` を新規作成し、`createCheckoutSession()` を実装する（constants のパック定義のみ使用・`client_reference_id: user.id`・success/cancel URL・pending 購入作成 / contracts/server-actions.md）。同ファイルの Vitest を追加する
- [X] T023 [US2] `service-front/src/app/api/stripe/webhook/route.ts` を新規作成する（POST のみ・署名検証 → T020 のドメイン関数へ委譲・応答規約 200/400/500 / contracts/stripe-webhook.md）
- [X] T024 [P] [US2] `service-front/src/features/credits/components/client/PurchasePackCard/` を新規作成する（購入ボタン → `createCheckoutSession()` → リダイレクト、送信中 disabled、`checkout_failed` の `role="alert"` / contracts/ui.md）
- [X] T025 [US2] `/generate-with-tests service-front/src/features/credits/components/client/PurchasePackCard/PurchasePackCard.tsx` を実行する
- [X] T026 [US2] `service-front/src/app/(authenticated)/settings/log-credits/page.tsx` を新規作成する（`generatePageMetadata`・PurchasePackCard 配置・`searchParams.checkout` の success/cancelled 通知 + success 時「ログ作成に戻る」リンク / contracts/ui.md）。NoCreditBanner の購入導線（`showPurchaseLink`）を有効化する
- [ ] T027 [US2] quickstart.md セクション 3・4 を実行する（Stripe CLI + テストカードで購入 / 冪等 / 失敗 / キャンセル / 返金）

**Checkpoint**: 収益フローが機能（購入 → 付与 → 消費の一巡）

---

## Phase 5: User Story 3 - 残枠の可視化と購入履歴 (Priority: P3)

**Goal**: 残枠をログ導線上で常時確認でき、購入履歴を一覧できる

**Independent Test**: ボーナス獲得・消費・購入の各操作後に表示残枠が最新化し、履歴に日時・内容・金額が並ぶ（US3 受け入れシナリオ）

- [X] T028 [P] [US3] `service-front/src/features/credits/components/server/CreditBalanceBadge/` を新規作成する（Server Component・`getCreditBalance()` 直呼び・「残りログ枠 N」テキスト表示 / contracts/ui.md）
- [X] T029 [US3] `/generate-with-tests service-front/src/features/credits/components/server/CreditBalanceBadge/CreditBalanceBadge.tsx` を実行する
- [X] T030 [P] [US3] `service-front/src/features/credits/server/queries.ts` に `getPurchaseHistory()` を追加する（pending 除外・created_at desc / contracts/server-actions.md）。Vitest を同期追加する
- [X] T031 [US3] `service-front/src/app/(authenticated)/settings/log-credits/page.tsx` を変更し、CreditBalanceBadge と購入履歴一覧（日時 JST・「ログ枠 10」・¥300・状態）を追加する（FR-014 / contracts/ui.md）
- [X] T032 [US3] `service-front/src/app/(authenticated)/dives/page.tsx`（ログ一覧）と `dives/new/page.tsx` に CreditBalanceBadge を配置する（FR-013「作成導線上で常に確認」）
- [ ] T033 [US3] US3 受け入れシナリオ 3 件（残枠表示 / 履歴 / 操作後の最新化）を手動確認する

**Checkpoint**: 全ストーリー完了

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T034 [P] `docs/product.md` の将来構想を更新する: 「ログブック追加課金（10 枚 500 円）」を本仕様（10 枠 300 円・実装済み）へ、「広告バナー設置」を廃止（spec Assumptions の明文化）
- [X] T035 [P] Playwright + axe-core の E2E を追加する: 残枠 0 ブロック → 購入導線 → （Stripe はモック/テストモード）→ 復帰の一連 + `/settings/log-credits` の a11y 検証
- [X] T036 quickstart.md セクション 5（回帰確認）を実行する: 既存機能の非影響・突合クエリ 0 行・広告非表示
- [X] T037 `npx biome check .` を実行し、指摘があれば `--write` + 手動修正で解消する
- [X] T038 `/sync-spec` を実行し、実装と specs/026（および 002/024 の関連記述: ログ作成が枠を消費する旨）のずれを解消する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（Setup）**: 依存なし
- **Phase 2（Foundational）**: Phase 1 完了後。**全ストーリーをブロック**
- **Phase 3（US1）**: Phase 2 完了後
- **Phase 4（US2）**: Phase 2 完了後（US1 と並行可。ただし T012 の NoCreditBanner が張る `/settings/log-credits` は T026 で実体化）
- **Phase 5（US3）**: Phase 2 完了後（T031 は T026 のページ作成後）
- **Phase 6（Polish）**: 全ストーリー完了後

### 主なタスク間依存

- T005 → T006 → T007 → T010（マイグレーション順）
- T008 は T005 の**前に**テストケースを確定（Test-First）、実行は T010 で
- T014 → T015 → T016（エラー伝搬の順）
- T019 → T020〜T023（購入 RPC が webhook 処理の前提）
- T026 → T031（ページ拡張）

### Parallel Opportunities

- Phase 1: T002 / T003 / T004 は並行可
- Phase 3: T011 と T012〜T013 は並行可
- Phase 4: T020〜T021 / T024〜T025 は並行可
- Phase 2 完了後、US1（開発者 A）・US2（開発者 B）を並行着手可能

---

## Implementation Strategy

**MVP = Phase 1〜3（US1）**。この時点で「枠 + デイリーボーナス」の無料体験が完結し、既存ユーザーへの影響（残枠 0 で書けない等）を先に観察できる。課金（US2）は Stripe アカウント・本番 webhook 設定が伴うため独立したリリースにし、US3 の可視化はいつでも後追いできる。

1. Phase 1 + 2 → `supabase db reset` + T008 green で基盤確定
2. Phase 3（US1）→ quickstart 1・2 で検証 → リリース可能（MVP）
3. Phase 4（US2）→ quickstart 3・4 で検証 → 課金リリース
4. Phase 5（US3）→ 可視化強化
5. Phase 6 → 回帰・biome・仕様同期で仕上げ

## Notes

- コミットはタスクまたは論理グループ単位。メッセージは `feat(026): ...` 形式
- 新規コンポーネントは folder-structure.md の 3 点セット + `/generate-with-tests` を徹底
- webhook 実装時、service_role キーをクライアントバンドルへ含めないこと（server-only モジュールに隔離）
