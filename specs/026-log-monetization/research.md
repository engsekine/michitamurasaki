# Research: ログ枠の有料化（026）

技術判断の記録。各項目は Decision / Rationale / Alternatives considered の形式。

## 1. 決済プロバイダ

**Decision**: Stripe Checkout（Hosted、`mode: 'payment'` の一回払い）を採用する。サーバー SDK `stripe` のみ導入し、クライアント SDK（`@stripe/stripe-js`）は使わない。

**Rationale**:

- 買い切り（サブスクなし）・少額 JPY・カード決済という要件に対し、ホスト型 Checkout はカード情報を一切自システムに通さず PCI DSS の負担が最小
- webhook（`checkout.session.completed`）・テストモード・Stripe CLI によるローカル webhook 転送など、開発/検証のエコシステムが最も充実
- 将来のパック追加・価格変更は Checkout Session 作成時のパラメータ（サーバー側定数）変更のみで対応可能

**Alternatives considered**:

- **Stripe Payment Links**: 実装は最少だが、ユーザーと購入の突合（`client_reference_id`）や履歴・冪等管理を自前で持つ本要件では Checkout Session API と手間が変わらない
- **PAY.JP / Komoju 等の国産 PSP**: JPY 特化だがドキュメント・SDK・テスト支援で Stripe に劣後。将来の海外ユーザーにも不利
- **アプリストア課金**: Web アプリのため対象外（spec Assumptions）

## 2. 枠消費の強制方式

**Decision**: `public.dives` への **AFTER INSERT トリガー**（`consume_log_credit()`）で 1 枠を原子的に消費する（ledger の `dive_id` FK が dives 行の存在を要求するため AFTER。例外時は同一トランザクションごとロールバックされ、原子性は BEFORE と等価）。残枠不足時は `raise exception ... using detail = 'no_credit'`（P0001）で insert 自体を失敗させ、アプリ層（`createDive` / `useDiveFormSubmit`）は error.details を判別してユーザー向け案内に変換する（独自 errcode は PostgREST が 500 に握りつぶすため、標準 P0001 + DETAIL をセンチネルにする — 実装時に実機検証済み）。

**Rationale**:

- ログ作成経路は現時点で `createDive`・`createDiveFromPlan`（024）の 2 つ。アプリ層チェックでは経路追加時の実装漏れが構造的に起こり得るが、トリガーなら全 insert を必ず通る
- 「残枠 1 で同時 2 リクエスト」（spec Edge Case）に対し、トリガー内で残高行を `for update` ロック → 減算 → `check (balance >= 0)` の三重で超過作成を防げる。アプリ層の check-then-insert は TOCTOU 競合を防げない
- 既存ログの遡及なし（FR-009）は「INSERT のみ対象・導入前の行は無関係」で自然に満たされる

**Alternatives considered**:

- **Server Action 内で RPC（消費）→ insert の 2 段呼び出し**: 非原子。消費成功後の insert 失敗で枠だけ減るケースの補償処理が必要になり複雑
- **insert を丸ごと Postgres 関数化（`create_dive_with_credit()`）**: 原子性は得られるが、既存 `createDive` の insert ロジック・バリデーションを SQL へ二重実装することになり保守コスト過大
- **seed / 管理操作への影響**: seed.sql はテストユーザーへ先に枠を付与してから dives を投入する順序に変更して対応（トリガー例外の回避）

## 3. 残高の持ち方

**Decision**: 追記専用レジャー `log_credit_ledger` を正とし、表示用に残高キャッシュ `log_credit_balances` を持つ。両者の更新は共通関数 `apply_credit_ledger_entry()` に閉じ、同一トランザクションで必ず両方書く。

**Rationale**:

- FR-016（増減の全記録・残高の検証可能性）にはレジャーが必須
- 残枠はヘッダー・ログ作成導線で毎リクエスト表示するため、都度 `sum(amount)` はユーザーのログ数増加に比例して劣化する。キャッシュは性能目的の意図的な非正規化（sql.md の非正規化ルールに従い、マイグレーションに理由コメントを残す）
- `check (balance >= 0)` を残高側に置くことで、関数バグがあっても DB 制約が最後の砦になる

**Alternatives considered**:

- **レジャーのみ（都度集計）**: 表示経路のコストと、消費時の集計+insert の競合制御が煩雑
- **残高のみ（履歴なし)**: FR-016 違反。返金・問い合わせ対応も不可能

## 4. 冪等性の担保

**Decision**: すべて DB の一意制約で担保する。

| 対象 | 仕組み |
|------|--------|
| デイリーボーナス（FR-003） | ledger に `granted_on date`（JST 暦日）を持ち、`unique (user_id, granted_on) where kind = 'daily_bonus'` の部分ユニークインデックス。`grant_daily_bonus()` は `on conflict do nothing` |
| 購入付与（FR-007） | `log_credit_purchases.stripe_checkout_session_id` にユニーク制約 + `credited_at` で付与済み判定。webhook 重複・リトライは 2 回目以降 no-op |
| 返金調整 | `stripe_refund_id` を ledger 参照に記録しユニークで重複調整を防止 |

**Rationale**: アプリ層のロック・フラグ管理は多重タブ・webhook リトライ・レプリカ遅延に弱い。一意制約なら Postgres が原子性を保証し、テストも「2 回呼んで 1 回分」で単純に書ける。

**Alternatives considered**: Redis 等の分散ロック（新規インフラで過剰）、Stripe イベント ID テーブル（session_id ユニークで十分なため不要）。

## 5. デイリーボーナスの付与タイミング

**Decision**: `app/(authenticated)/layout.tsx` から `grant_daily_bonus()` RPC を呼ぶ。RPC は「当日（JST）未付与なら +1、付与済みなら no-op」の冪等関数。

**Rationale**:

- clarify 回答「訪問時に自動付与（受け取り操作なし）」を全認証ページ共通で満たす唯一の合流点が authenticated layout（016 のプロフィール補完ゲートと同じ判断）
- 付与済み日の再訪問は部分ユニークインデックスのプローブ 1 回で終わり、レイアウトへの負荷は既存の user_details チェックと同等
- JST 暦日は `(now() at time zone 'Asia/Tokyo')::date` で DB 側で判定（クライアント時計に依存しない）

**Alternatives considered**:

- **cron（毎日 0 時に全員へ付与）**: clarify で不採用（訪問時付与を選択）。休眠ユーザーへの無駄な行増加も避けられる
- **middleware / proxy.ts**: Edge からの DB 書き込みは接続管理が煩雑でレイテンシに直撃する

## 6. 返金の扱い

**Decision**: `charge.refunded` webhook を受けて、該当購入の付与枠（10）を上限に **未消費分だけ** 負の調整エントリを積む。残高が調整額に満たない場合は残高が 0 になる分までで床打ちする（spec Edge Case 準拠）。購入レコードは `refunded` 状態へ更新する。

**Rationale**: 消費済み枠まで差し引くと残高がマイナスになり `check` 制約と衝突する。床打ちは spec の決定事項であり、悪用（購入→消費→返金）はサポート運用（返金可否の判断）側で防ぐ。

**Alternatives considered**: 残高マイナス許容（作成ブロックの実装が別途必要になり、`check >= 0` の防壁も失う）。

## 7. パック定義の置き場所

**Decision**: 初期リリースは単一パック（10 枠 / 300 円）を `features/credits/constants.ts` にサーバー側定数として定義し、Checkout Session の `line_items`（`price_data` インライン指定）と ledger 付与数の両方をこの定数から参照する。DB のパックマスタは作らない。

**Rationale**: パックが 1 種の間はテーブルが過剰（YAGNI）。金額・数量はクライアントから受け取らずサーバー定数のみを使うため、改ざん耐性は変わらない。spec の「パック定義を固定値とみなさない」は、定数を 1 箇所に集約し購入レコードへ数量・金額をスナップショット保存する（過去履歴が価格改定に影響されない）ことで満たす。

**Alternatives considered**: `credit_packs` マスタテーブル（複数パック・管理画面での価格変更が要件化された時点で導入）、Stripe Price オブジェクト参照（ダッシュボード側との二重管理になるため初期は `price_data` インラインを選択）。
