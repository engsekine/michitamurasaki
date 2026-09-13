# Contract: 画面・ルーティング（033-dive-shops）

## 新規ルート（すべて認証必須）

| ルート | ページ | 内容 |
|---|---|---|
| `/shops` | 一覧 | 自分のショップ一覧（名前・住所の要約）。空状態は登録導線付きメッセージ。「ショップを登録」ボタン → `/shops/new` |
| `/shops/new` | 新規登録 | ShopForm（名前必須・住所・電話・URL・メモ）。住所確定で地図プレビュー。成功で `/shops/[id]`（詳細）へ |
| `/shops/[id]` | 詳細 | 全項目 + 地図（座標あり時）+ 紐付いた予定・ログの逆引き一覧（0 件時はその旨表示）。編集・削除導線 |
| `/shops/[id]/edit` | 編集 | ShopForm（初期値入り）。成功で詳細へ戻る |

- 各ページは `generatePageMetadata` で metadata をエクスポートし、`Header` / `Footer` を含める（既存の認証済みページと同じ構成）
- 他人のショップ id へのアクセスは RLS により取得 0 件 → `notFound()`

## 既存ファイルの変更

| ファイル | 変更 |
|---|---|
| `service-front/src/proxy.ts` | `APP_ROUTE_PREFIXES` に `'/shops'` を追加（認証ガード。これ以外の変更なし） |
| `shared/components/layout/Header/Header.tsx` | `NAV_ITEMS` に `{ href: '/shops', label: 'ショップ' }` を追加 |
| `shared/components/layout/Header/HeaderMobileNav.tsx` | モバイルナビにも同項目を追加 |
| `features/dives`（DiveForm / 詳細） | ショップ選択欄（options は page から props 注入）・ログ詳細にショップ名 + `/shops/[id]` リンク |
| `features/plans`（PlanForm / 詳細） | 同上（予定詳細にショップ名 + リンク） |
| `features/application-sheet`（ApplicationSheetForm） | 宛先ショップ選択欄（保存対象・次回復元） |
| `service-front/.env.example` | `GOOGLE_MAPS_API_KEY` を追記（サーバー専用） |

## 表示契約（FR-015: 非公開の保証）

- ショップ情報を表示してよいのは: `/shops` 配下・予定/ログの本人向け詳細・各フォーム
- **変更してはならないもの**: 公開ログ詳細（他者閲覧）・タイムライン・いいね一覧など公開系の query / コンポーネント（ショップの select・join を追加しない）

## 地図表示契約

- `ShopMap`（Server Component）: props `latitude` / `longitude` / `shopName`
  - 座標あり → `<iframe title="{shopName} の地図" src="https://maps.google.com/maps?q={lat},{lng}&z=16&output=embed" loading="lazy">`
  - 座標なし（住所未入力 or 解決失敗）→ iframe を描画せず `role="status"` のメッセージ（「住所から地図を表示できません」等）
- 登録・編集画面のプレビューは ShopForm 内で `geocodeAddress` action の結果を使い同じ表示規則に従う
