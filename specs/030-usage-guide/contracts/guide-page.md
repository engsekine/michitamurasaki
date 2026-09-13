# Contract: 使い方ページ（/guide）

**Date**: 2026-07-08 | **Plan**: [../plan.md](../plan.md)

UI アプリケーションのため、ページ・ナビゲーション・コンポーネントの公開契約を定義する。

## ルート契約

| 項目 | 契約 |
|---|---|
| URL | `/guide` |
| 認証 | 不要（未ログインでリダイレクトされない。proxy.ts の `APP_ROUTE_PREFIXES` に **追加しない**こと） |
| HTTP ステータス | 200（未ログイン・ログイン済みの両方） |
| metadata | `generatePageMetadata(PAGE_DATA)`。**noIndex なし**（robots: index 許可・FR-010）。title「使い方」・canonical `/guide` |
| レイアウト | ルートレイアウト共通の Header / Footer を含む |

## ページ構造契約（アクセシビリティ含む）

| 要素 | 契約 |
|---|---|
| h1 | 1 つ（「使い方」）。見出し階層は h1 → h2（各セクション）→ h3（ステップ等）で飛ばさない |
| 目次 | `<nav aria-label="目次">` 内のアンカーリンク。6 セクションすべてに対応（FR-003） |
| セクション | 6 つ。各 `<section>` は `aria-labelledby` で h2 と関連付け、h2 は `id`（data-model.md の id 列）を持つ |
| 手順 | 各セクションに番号付きリスト（`<ol>`）で表示（FR-008） |
| 機能導線 | 各セクションに 1 つ以上のリンク（FR-004）。未ログイン時のログイン必須先は既存認証ガードに委ねる |
| 登録導線 | `/signup` へのリンクをページ内に配置（FR-005） |
| 例示表示 | 表示専用コンポーネントのみ。`figure` + キャプション「表示イメージ（サンプル）」で囲む。リンクを含む例示（`RecentDives`）は `inert` で操作・フォーカス対象から外し、なくても手順が完結する（FR-009） |
| axe-core | 違反 0 件（WCAG 2.1 AA・FR-007） |

## ナビゲーション契約（FR-006）

| 箇所 | 契約 |
|---|---|
| ヘッダー（デスクトップ） | メインナビゲーションに「使い方」→ `/guide` を追加 |
| ヘッダー（モバイル） | モバイルメニュー内に「使い方」→ `/guide` を追加 |
| フッター | `FOOTER_LINKS` に `{ href: '/guide', label: '使い方' }` を追加 |
| TOP ダッシュボード（FR-011） | 末尾に `GuideIntroSection`（見出し「使い方ガイド」+ 紹介文（`PAGE_DATA.description` を流用）+ 「使い方を見る」→ `/guide`） |

## feature 公開 API 契約（`features/guide/index.ts`）

| エクスポート | 種別 | 用途 |
|---|---|---|
| `GuideView` | Server Component | ページ本体（目次 + セクション描画）。`examples?: Record<string, ReactNode>` を受け取る |
| `GuideIntroSection` | Server Component | TOP ダッシュボード末尾に置く導入バナー（FR-011） |
| `PAGE_DATA` | 定数 | metadata 生成用（slug / title / description） |
| `GUIDE_SECTIONS` | 定数 | セクション定義（data-model.md の型に従う） |

- guide feature は他 feature を import しない（依存は shared のみ）
- 例示コンポーネントの組み立ては `app/(public)/guide/page.tsx` の責務
