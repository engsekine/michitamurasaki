# Research: ダイビングショップ登録（033-dive-shops）

Phase 0 の技術調査。spec.md の要件（特に FR-011〜013 の地図、FR-007〜010 の紐付け、FR-015 の非公開）を実現する方式を確定する。

## Decision 1: 地図表示は Google マップ埋め込み iframe（座標指定・キー不要）

- **Decision**: ショップの位置は `https://maps.google.com/maps?q={lat},{lng}&z=16&output=embed` を `src` とする iframe（Server Component `ShopMap`）で表示する。iframe には内容を説明する `title` を付け、`loading="lazy"` とする
- **Rationale**:
  - 追加 npm パッケージ・クライアントサイド API キーが不要で、バンドルサイズ・キー管理の負担がない
  - 座標指定なら住所の解釈ブレがなく、ジオコーディング結果（Decision 2）と表示が必ず一致する
  - Server Component のまま完結し、Constitution II（Server Components First）に沿う
- **Alternatives considered**:
  - **Maps JavaScript API**: ピン操作等の高度な UI が可能だが、クライアントキーの露出・referrer 制限管理・バンドル増が必要。スペックのスコープ（位置確認のみ・ピン調整はスコープ外）に対して過剰
  - **Maps Embed API（place モード・住所直接指定）**: iframe 内で住所解決されるため「位置を特定できない」の検知（FR-013）が cross-origin で不可能。キーも必要
  - **Maps Static API（静的画像）**: 課金必須・キー必要。ズーム操作もできない

## Decision 2: 住所→座標の解決は Google Geocoding API（サーバー専用キー）+ 座標を DB 保存

- **Decision**: 住所の座標解決は Google Geocoding API（REST）をサーバー側（`features/shops/lib/geocode/`、`fetch` 使用）から呼ぶ。キーは env `GOOGLE_MAPS_API_KEY`（サーバー専用・クライアントに露出しない）。解決結果の `latitude` / `longitude` は保存時に `dive_shops` へ永続化し、詳細表示では保存済み座標のみ使う（表示のたびに外部 API を呼ばない）。編集で住所が変わった場合のみ再解決する
- **Rationale**:
  - `ZERO_RESULTS` を明示的に検知でき、FR-013（特定できない場合のメッセージ表示・保存は妨げない）をテスト可能な形で満たせる
  - 座標を保存することで詳細画面の表示が外部 API の可用性・レイテンシ・課金に依存しない（毎回解決する方式は SC-003 の安定達成が難しい）
  - キーをサーバー env に閉じ込め、Constitution IV（Security）に沿う
- **Alternatives considered**:
  - **毎回表示時にジオコーディング**: API 呼び出し回数が増え、外部障害がショップ詳細の表示に直結する。座標は住所から導出可能な値だが、外部 API 依存の解決結果であり再現性がない（同じ住所でも結果が変わりうる）ため、冗長保存を許容する（`rules/sql.md` の非正規化ルールに従い data-model.md に理由を記載）
  - **OpenStreetMap Nominatim（キー不要）**: 無料だが利用ポリシー上の制約（リクエストレート・商用利用）と日本の住所の解決精度に不安。表示（Google マップ）と解決（OSM）でサービスが割れて位置がずれるリスクもある
- **運用ノート**: `GOOGLE_MAPS_API_KEY` 未設定のローカル環境では、ジオコーディングを呼ばず「地図を利用できない」旨のメッセージにフォールバックする（登録・編集・閲覧は全て動作する）。`.env.example` に追記する

## Decision 3: 紐付けは各テーブルへの nullable FK（`on delete set null`）+ 所有者ガード

- **Decision**: `dives` / `dive_plans` / `application_sheets` に `dive_shop_id uuid references public.dive_shops(id) on delete set null` を追加する（すべて nullable・FK インデックス付き）。他人のショップ id を設定できないよう、(1) Server Action での本人所有チェック、(2) DB トリガー `ensure_dive_shop_owned`（`dive_shop_id` 設定時に `dive_shops.user_id = 対象行の user_id` を検証）の二重ガードとする
- **Rationale**:
  - 「任意で 1 件」（spec Assumptions）は nullable FK が最も単純で、`on delete set null` により FR-010（ショップ削除で紐付けのみ解除・データは残す）が DB レベルで保証される（SC-005）
  - RLS はショップの読み取りを本人に限定するが、FK 制約自体は他人の行 id でも成立しうるため、トリガーでの整合性ガードが必要（`dive_log_buddies` の update ガードと同じ手法）
- **Alternatives considered**:
  - **中間テーブル（多対多）**: 複数ショップの紐付けはスコープ外（spec Assumptions）。1:N の FK で十分
  - **アプリ側チェックのみ**: RLS・制約を DB 側で表現する原則（`rules/sql.md`）に反する

## Decision 4: 申し込みシートへの紐付けは `application_sheets.dive_shop_id`

- **Decision**: 申し込みシート（032 改め、保存シート機能を含む現行設計）は名前付きスナップショットを `application_sheets` に複数保存するため、シートへのショップ紐付けは `application_sheets.dive_shop_id` に「そのシートの宛先ショップ」として記録する。シート作成画面のショップ選択欄はシート保存（「シートを保存する」）でスナップショットに含まれ、保存済みシートを開くと復元される
- **Rationale**: シートがレコードとして保存される現行設計では「どのショップ宛のシートか」をシート単位で持てる。spec の「どのショップ宛のシートかが分かる」（US2-3）はシートごとの宛先保存で満たす
- **Alternatives considered**:
  - **ユーザー単位（1 件）の宛先記録**: 旧 application_profiles（1 ユーザー 1 行）時代の設計。シートを複数保存できる現行設計ではシートごとに宛先が異なるため不適
## Decision 5: ショップ選択肢の受け渡しは page 合成（props 注入）

- **Decision**: 予定・ログ・申し込みシートの各フォームへのショップ選択欄は、page（Server Component）が `features/shops/server/queries` の `getShopOptions()`（`{ id, name }[]`）を取得し、各 feature のフォームコンポーネントに **データ props として注入**する。フォーム側は受け取った options で `<select>` を描画する（shops feature のコンポーネントは import しない）
- **Rationale**: feature 間 import 禁止（`arch/feature-based.md`）。TopDashboard が他 feature のデータ・コンポーネントを page 合成で受け取るのと同じ確立済みパターン
- **Alternatives considered**:
  - **shared/ に ShopSelect を昇格**: ショップは shops feature 固有のドメイン。横断利用されるのはデータ（選択肢）だけなので、コンポーネント共有は不要
  - **各 feature から shops の queries を直接 import**: 依存方向の破壊。禁止

## Decision 6: 公開ビューの非表示（FR-015)は「公開系 query に shop を含めない」ことで満たす

- **Decision**: ショップ名・情報の表示は本人向け画面（ショップ画面・予定/ログ詳細・各フォーム）に限定する。公開ログ・タイムライン・いいね一覧など他ユーザーが閲覧する既存の query / コンポーネントには `dive_shop_id` の select・join を一切追加しない
- **Rationale**: 表示側で出し分けるより、公開系のデータ取得にショップを含めない方が漏えいの余地が構造的にない。RLS でも他人の `dive_shops` 行は読めないため二重に安全
- **Alternatives considered**: 公開ビューでの条件分岐表示 — 分岐漏れのリスクがあり、追加する理由がない
