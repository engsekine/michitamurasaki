# Contract: UI（026）

新規コンポーネントは folder-structure.md の 3 点セット（本体 + test + index、client は story も）で作成し、`/generate-with-tests` を実行する。

## CreditBalanceBadge（server / features/credits/components/server/）

- **配置**: TOP（ダッシュボード）・ログ一覧・ログ作成ページ + `/settings/log-credits`（FR-013「作成導線上で常に確認できる」）
- **表示**: 「残りログ枠 N」のテキスト。色のみに依存せず、残枠 0 でもテキストで判別可能（a11y）
- **導線**: バッジ自体が `/settings/log-credits` へのリンク（`aria-label` に遷移先を含める）。残枠が尽きる前に能動的に購入へ進める常設導線を兼ねる
- **データ**: Server Component で `getCreditBalance()` を直接呼ぶ

## 購入ページへの常設導線（追補）

- アカウントメニュー（`AuthNav`）に「ログ枠の購入」リンク（`/settings/log-credits`）を追加。「保有資格」の下に配置

## NoCreditBanner（client / features/credits/components/client/）

- **表示条件**: 残枠 0 でログ作成を試みた（`no_credit` エラー受領）または残枠 0 で作成ページを開いた
- **内容**: `role="alert"`。「ログ枠がありません」+ デイリーボーナスの説明（明日また 1 枠増える）+ `/settings/log-credits` への購入導線リンク（FR-002 / US2-AC4）
- **段階リリース対応**: 購入導線リンクは `showPurchaseLink` prop（default: true）で条件表示。US1 単独リリース時は false にして 404 リンクを出さず、US2 のページ実装時に有効化する（analyze G1）
- **a11y**: リンク・ボタンは 44px 相当、キーボード到達可能、コントラスト 4.5:1

## PurchasePackCard（client / features/credits/components/client/）

- **内容**: `pack` prop（`LogCreditPack`）で 1 パックを受け取り、パック名・価格・単価（円/ログ）・割引率（`discountLabel`）・「購入する」ボタンを表示。おすすめパック（`isRecommended`）は「おすすめ」バッジ + アクセント枠線。押下で `createCheckoutSession(pack.id)` を呼び `url` へフルページリダイレクト
- **状態**: 送信中 disabled + ローディング表示。`checkout_failed` はカード内に `role="alert"` で失敗理由と再試行ボタン
- **注記**: 価格・数量は表示専用（`features/credits/constants.ts` の `LOG_CREDIT_PACKS` 由来）。サーバーへ渡すのは packId のみ

## /settings/log-credits ページ（server）

- **構成**: `generatePageMetadata` 使用。上から (1) CreditBalanceBadge（現在残枠）、(2) PurchasePackCard × 3（`LOG_CREDIT_PACKS` を map。お試し 10 枠 ¥480 / おすすめ 30 枠 ¥1,200 / たっぷり 100 枠 ¥3,000）、(3) 購入履歴一覧
- **購入履歴**: 日時（JST 表示）・内容（「ログ枠 {quantity}」）・金額（購入時スナップショット）・状態（完了 / 返金済み）。`role="table"` 相当のセマンティクス（FR-014 / US3-AC2）
- **決済結果の受理**: `searchParams.checkout`
  - `success`: 「購入ありがとうございます」通知（`role="status"`）。webhook 反映前の可能性があるため「反映まで最大 1 分かかることがあります」を添え、残枠は都度サーバーフェッチ（SC-003 / spec Edge Case「反映待ち」）。「ログ作成に戻る」リンク（`/dives/new`）を併記し購入→作成復帰の動線を閉じる（US2-AC4）
  - `cancelled`: 「購入はキャンセルされました」通知
- **Header / Footer**: 既存 settings 配下の慣例に従う

## DiveForm（既存変更・features/dives）

- 残枠 0 のとき: 送信ボタンは活性のまま（サーバー側が最終判定）だが、ページ表示時点で残枠 0 なら NoCreditBanner を先行表示
- 送信で `no_credit` を受けたとき: NoCreditBanner を表示し、入力値は保持する（再購入後に再送信できる）
- test / story を同期更新（テスト同期ルール）

## 文言（初期案・実装時に確定）

| キー | 文言 |
|------|------|
| 残枠バッジ | 残りログ枠 {n} |
| 残枠 0 タイトル | ログ枠がありません |
| 残枠 0 本文 | ログ枠は毎日 1 つ自動で追加されます。今すぐ記録するにはログパックを購入してください。 |
| 残枠 0 バナーの購入リンク | ログパックを購入（¥480 から） |
| 購入カードのボタン | 購入する（カード見出しにパック名「お試しパック（10 枠）」等と価格・単価・割引率を表示。送信中は「手続きを開始しています...」） |
| 購入成功 | ご購入ありがとうございます / 残枠への反映まで最大 1 分ほどかかることがあります。反映されない場合はページを再読み込みしてください。 |
| 購入キャンセル | 購入はキャンセルされました。 |
| 枠不足の送信エラー（createDive） | ログ枠がないため作成できません |
