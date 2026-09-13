# Implementation Plan: ダイビングショップ登録

**Branch**: `033-dive-shops` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/033-dive-shops/spec.md`

## Summary

ユーザーが行きつけのダイビングショップ（名前・住所・電話番号・Web サイト URL・メモ）をプライベートデータとして登録・管理できるようにする。ショップは予定（`dive_plans`）・ログ（`dives`）・保存済み申し込みシート（`application_sheets`）へ任意で 1 件紐付けられ、ショップ詳細からは紐付いた予定・ログを逆引きできる。住所は入力確定時に Google Geocoding API（サーバー専用キー）で座標に解決し、Google マップの埋め込み iframe で地図を表示する。座標は保存時に `dive_shops` に永続化し、表示のたびに再解決しない。公開ログ・タイムラインにはショップ情報を一切出さない（本人閲覧画面のみ）。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router（React 19 + React Compiler）

**Primary Dependencies**: Supabase（PostgreSQL + Auth + RLS）/ React Hook Form + yup / Tailwind CSS。新規 npm パッケージは追加しない（地図は iframe 埋め込み、ジオコーディングは `fetch` で REST 呼び出し）

**Storage**: Supabase PostgreSQL。新テーブル `dive_shops`、既存 `dives` / `dive_plans` / `application_sheets` に `dive_shop_id` 列を追加（マイグレーション SQL 経由のみ）

**Testing**: Vitest（単体）/ Storybook（story）/ Playwright + axe-core（E2E・a11y）

**Target Platform**: Web（service-front / `http://localhost:3000`）。admin-front は対象外

**Project Type**: Web application（モノレポ内 service-front ワークスペース）

**Performance Goals**: 既存画面と同等（一覧・詳細は Server Components の 1 往復で描画）。ジオコーディングは住所確定時と保存時のみ（表示時は保存済み座標を使用し外部 API を呼ばない）

**Constraints**: 外部依存は Google Geocoding API（サーバー専用 env `GOOGLE_MAPS_API_KEY`）のみ。未設定・障害時も登録・閲覧機能は劣化なしで動作し、地図のみ非表示（FR-013）。ショップ情報は公開ビューに一切出さない（FR-015）

**Scale/Scope**: 1 ユーザーあたりショップ数十件想定。新規画面 4（一覧・新規・詳細・編集）+ 既存 3 フォーム（予定・ログ・申し込みシート）への選択欄追加

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. Spec-Driven Development | PASS | spec.md（clarify 4 件反映済み）→ 本 plan → tasks の順で進行 |
| II. Server Components First | PASS | 一覧・詳細・地図（iframe）・逆引き一覧は Server Components。Client は ShopForm（RHF）・住所確定時の地図プレビュー・削除ボタンのみ |
| III. Test-First | PASS | 新規コンポーネントは Vitest + story + Playwright a11y を同梱（`/generate-with-tests` 相当）。schema・ジオコーディング lib は単体テスト先行 |
| IV. Security & RLS by Default | PASS | `dive_shops` は RLS 有効 + 本人限定 4 ポリシー。`dive_shop_id` の所有者整合はサーバー検証 + DB トリガーで担保。ジオコーディングキーはサーバー専用 env |
| V. Accessibility (WCAG 2.1 AA) | PASS | フォームは label 関連付け・`aria-invalid`・`role="alert"`。地図 iframe に `title`、地図非表示時は `role="status"` のメッセージ。Playwright + axe でスイープ |
| VI. Coding Standards | PASS | Feature-based（`features/shops/`）・フォルダ構成規約・snake_case / 3NF / timestamptz |

違反なし（Complexity Tracking 不要）。

## Project Structure

### Documentation (this feature)

```text
specs/033-dive-shops/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── routes.md        # 画面・ルーティング・ナビ変更の契約
│   └── server-actions.md# Server Actions / queries / ジオコーディングの契約
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
supabase/migrations/
├── 20260711XXXXXX_create_dive_shops.sql        # 新テーブル + RLS + トリガー
└── 20260711XXXXXX_add_dive_shop_links.sql      # dives / dive_plans / application_sheets に dive_shop_id 追加 + 所有者ガード

service-front/src/features/shops/               # ★新規 feature
├── components/
│   ├── client/
│   │   ├── ShopForm/                           # 登録・編集フォーム（RHF + yup。住所確定で地図プレビュー更新）
│   │   └── DeleteShopButton/                   # 確認ダイアログ付き削除
│   └── server/
│       ├── ShopList/                           # 一覧（空状態含む）
│       ├── ShopMap/                            # 座標→Google マップ iframe（座標 null なら status メッセージ）
│       └── ShopLinkedRecords/                  # 逆引き（紐付いた予定・ログ一覧）
├── schemas/shop.schema.ts                      # yup スキーマ（name 必須 120 / address 255 / phone 形式 / url 形式 / memo 1000）
├── lib/geocode/                                # Google Geocoding API クライアント（server-only・fetch）
├── server/
│   ├── queries.ts                              # getShops / getShop / getLinkedRecords / getShopOptions
│   └── actions.ts                              # createShop / updateShop / deleteShop / geocodeAddress
├── constants.ts                                # PAGE_DATA・文言・上限値
└── types.ts

service-front/src/app/(authenticated)/shops/    # ★新規ルート
├── page.tsx                                    # 一覧
├── new/page.tsx                                # 新規登録
└── [id]/
    ├── page.tsx                                # 詳細（地図 + 逆引き一覧）
    └── edit/page.tsx                           # 編集

# 既存ファイルへの変更
service-front/src/proxy.ts                      # APP_ROUTE_PREFIXES に '/shops' 追加
service-front/src/shared/components/layout/Header/          # NAV_ITEMS に「ショップ」追加（モバイルナビ含む）
service-front/src/features/dives/    # DiveForm にショップ選択欄（options は props 注入）・schema・actions・詳細表示
service-front/src/features/plans/    # PlanForm 同上・予定詳細表示
service-front/src/features/application-sheet/   # ApplicationSheetForm にショップ選択・保存対象に追加
```

**Structure Decision**: Feature-based + shared/ 構造に従い `features/shops/` を新設する。feature 間 import 禁止のため、予定・ログ・申し込みシートのフォームには **ショップ選択肢データ（`{ id, name }[]`）を page 側で `features/shops/server/queries` から取得して props で注入**する（TopDashboard の slot/props パターンと同じ）。逆引き一覧（ShopLinkedRecords）も page 側で dives / plans の型に依存しない表示用データに変換して渡す。

## 設計詳細

### 地図表示・ジオコーディング（research.md Decision 1・2）

- 住所 → 座標: **Google Geocoding API** をサーバー（Server Action `geocodeAddress` / 保存系 action 内部）から `fetch` で呼ぶ。キーは `GOOGLE_MAPS_API_KEY`（`NEXT_PUBLIC_` を付けない・クライアント露出禁止）
- 地図表示: 座標を `https://maps.google.com/maps?q={lat},{lng}&z=16&output=embed` の iframe（`ShopMap`）で表示。追加ライブラリ・クライアントキー不要
- 座標は `dive_shops.latitude` / `longitude` に保存し、詳細表示では再解決しない。住所が変更された保存時のみ再解決
- 入力確定（住所欄 blur・値変更時）に `geocodeAddress` を呼びプレビュー更新（FR-011）。`ZERO_RESULTS` / キー未設定 / API 障害時は地図の代わりに `role="status"` のメッセージを表示し、保存は妨げない（FR-013）

### 紐付け（research.md Decision 3）

- `dives.dive_shop_id` / `dive_plans.dive_shop_id` / `application_sheets.dive_shop_id`（いずれも nullable・`on delete set null`）
- ショップ削除時は DB の `on delete set null` で紐付けだけが外れる（FR-010 / SC-005）
- 他人のショップ id を紐付けられないよう、サーバー検証（本人所有チェック）+ DB トリガー（`ensure_dive_shop_owned`）の二重ガード
- 公開ログ・タイムラインの query / コンポーネントはショップを select しない（FR-015。既存公開ビューは変更しないことで満たす）

### ルーティング

- `/shops` 配下は認証必須。`proxy.ts` の `APP_ROUTE_PREFIXES` に `'/shops'` を追加する（それ以外の proxy 変更はなし）
- ヘッダーナビ（デスクトップ・モバイル両方）に「ショップ」を追加する

## Complexity Tracking

違反なし。
