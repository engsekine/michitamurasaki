# Contract: Server Actions / Queries（033-dive-shops)

すべて `service-front/src/features/shops/server/` に配置。戻り値は既存の `ActionResult` 規約（`@/shared/types/action-result`）に従う。認証は `requireUser` で行い、DB アクセスは RLS 下で本人行のみに閉じる。

## Queries（`server/queries.ts`）

| 関数 | シグネチャ | 内容 |
|---|---|---|
| `getShops()` | `() => Promise<Shop[]>` | 自分のショップ一覧（`name` 昇順） |
| `getShop(id)` | `(id: string) => Promise<Shop \| null>` | 詳細 1 件。RLS により他人の id は null |
| `getShopOptions()` | `() => Promise<ShopOption[]>`（`{ id, name }[]`） | フォーム選択肢用の軽量版。予定・ログ・シートの page から呼び、各フォームに props 注入する |
| `getLinkedRecords(shopId)` | `(shopId: string) => Promise<{ plans: LinkedPlan[]; dives: LinkedDive[] }>` | 逆引き一覧（FR-016）。`dive_plans` は `planned_on` 降順、`dives` は `dive_date` 降順 |

## Actions（`server/actions.ts`）

### `createShop(input: ShopInput): Promise<ActionResult<{ id: string }>>`

1. yup スキーマでサーバー側再検証（name 必須 120 / address 255 / phone 形式 20 / URL 形式 2048 / memo 1000）
2. `address` が非空なら `geocode(address)` を実行し `latitude` / `longitude` を取得（失敗・キー未設定時は null のまま続行 — 保存を妨げない: FR-013）
3. `dive_shops` に INSERT（`user_id = auth.uid()`）
4. 成功で `{ id }` を返す（呼び出し側で `/shops/[id]` へ遷移）

### `updateShop(id: string, input: ShopInput): Promise<ActionResult>`

- 検証は createShop と同じ。**住所が変更された場合のみ**再ジオコーディングする（同一なら保存済み座標を維持）
- 住所が空に変更された場合は座標も null にする

### `deleteShop(id: string): Promise<ActionResult>`

- 本人行を DELETE。紐付け解除は DB の `on delete set null` に委ねる（アプリ側で予定・ログを触らない）
- 成功後 `/shops` へ redirect

### `geocodeAddress(address: string): Promise<ActionResult<GeocodeResult>>`

- 登録・編集画面の地図プレビュー用（FR-011。住所欄の入力確定時に呼ばれる）
- `GeocodeResult = { latitude: number; longitude: number } | { latitude: null; longitude: null }`（null = 特定不可）
- キー未設定・API エラー・`ZERO_RESULTS` はすべて null 座標の**成功応答**として返す（フォーム側は「地図を表示できない」表示に切り替える。エラー扱いにして保存を妨げない）
- 空文字入力は API を呼ばず null 座標を返す

## Geocode lib（`lib/geocode/`）

| 関数 | 内容 |
|---|---|
| `geocode(address: string)` | Google Geocoding API（`https://maps.googleapis.com/maps/api/geocode/json`）を `fetch` で呼び、先頭結果の `{ lat, lng }` を返す。`ZERO_RESULTS` / エラー / `GOOGLE_MAPS_API_KEY` 未設定は `null` を返す。server-only（`import 'server-only'` 相当のガード） |

- 単体テストは `fetch` をモックして OK / ZERO_RESULTS / HTTP エラー / キー未設定の 4 系統を検証する

## 既存 feature の変更契約

| 対象 | 変更 |
|---|---|
| `features/dives`（schema / actions / queries） | `diveShopId: string \| null` を入力に追加。作成・更新 action は本人所有チェック（不正 id は actionFailure）。詳細 query はショップ `{ id, name }` を join で取得（本人向け画面のみ） |
| `features/plans`（同上） | 同上 |
| `features/application-sheet` | シート保存 action の入力・`application_sheets` の行に `dive_shop_id` を追加。保存済みシートを開くと宛先を復元 |
| 公開系（social / likes 等） | **変更しない**（FR-015） |
