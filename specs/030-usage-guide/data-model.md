# Data Model: アプリの使い方ページ

**Date**: 2026-07-08 | **Plan**: [plan.md](./plan.md)

## DB エンティティ

**なし。** 本機能は静的コンテンツのみで、テーブル追加・マイグレーション・RLS 変更は発生しない。

## コンテンツ構造（TypeScript 型・`features/guide/types.ts`）

DB には保存しないが、ページを構成するコンテンツのデータ構造を定義する（`constants.ts` の GUIDE_SECTIONS がこの型に従う）。

### GuideSection（セクション）

| フィールド | 型 | 説明 | 制約 |
|---|---|---|---|
| `id` | `string` | セクションの一意 id。目次アンカー（`#<id>`）と見出しの `id` に使う | kebab-case・ページ内で一意 |
| `title` | `string` | セクション見出し（h2） | 必須 |
| `description` | `string` | セクションの導入文（1〜2 文） | 必須 |
| `steps` | `GuideStep[]` | 操作手順（番号付きで描画・FR-008） | 1 件以上 |
| `links` | `GuideLink[]` | 機能画面への導線（FR-004） | 1 件以上 |

### GuideStep（手順 1 ステップ）

| フィールド | 型 | 説明 | 制約 |
|---|---|---|---|
| `title` | `string` | ステップの短い見出し | 必須 |
| `body` | `string` | ステップの説明文。テキストのみで手順が完結すること（FR-009） | 必須 |

### GuideLink（機能導線）

| フィールド | 型 | 説明 | 制約 |
|---|---|---|---|
| `href` | `Route`（next） | 遷移先パス。typedRoutes で実在するアプリ内ルートに限定する | 必須 |
| `label` | `string` | リンクラベル | 必須 |
| `requiresAuth` | `boolean` | ログイン必須機能か（未ログイン時は既存の認証ガードでログイン画面に誘導される） | 必須 |

### 例示表示（slot）

例示表示は型に含めない。`GuideView` が `Record<セクション id, ReactNode>` 形式の `examples` prop を受け取り、app 層（`page.tsx`）がサンプルデータ付きコンポーネントを注入する（research.md Decision 4）。

## セクション定義（GUIDE_SECTIONS の内容・FR-002）

| # | id | title | 主な内容 | 例示表示（確定） |
|---|---|---|---|---|
| 1 | `getting-started` | はじめに | 登録 → プロフィール設定 → 最初のログ作成 → ダッシュボード確認の基本フロー | なし（テキストのみ） |
| 2 | `dive-logs` | ダイブログを記録する | ログの作成・写真添付・一覧検索 | `RecentDives`（dashboard feature・サンプルログ 3 件。リンク先が実在しないため `inert` で操作対象から外す） |
| 3 | `plans-packing` | ダイビング予定と持ち物リスト | 予定作成・持ち物チェック・予定からログへの記録 | なし（`NextPlanCardView` は操作系の `PackingChecklist` を含むため対象外 → テキストのみ） |
| 4 | `dashboard` | ダッシュボードで振り返る | 統計・推移チャート・レギュレーター OH の見方 | `BarChart`（shared・サンプル年別本数。非対話 SVG で aria-label 付き） |
| 5 | `social-likes` | みんなのログ・いいね | タイムライン閲覧・いいね・いいねしたログ一覧 | なし（テキストのみ） |
| 6 | `log-credits` | ログ枠と追加購入 | 作成上限（ログ枠）の仕組みと残枠確認・追加購入の流れ | なし（テキストのみ） |

- 例示表示は表示専用コンポーネントのみ（操作系・Server Action 付きは不可）。`ExampleFrame`（figure + 「表示イメージ（サンプル）」キャプション）で囲み、サンプルであることを明示する
- 未登録閲覧者向けの登録導線（FR-005）は `getting-started` セクションの links（`/signup`・`requiresAuth: false`）とページ末尾の CTA で満たす

## 状態遷移

なし（表示のみ・状態を持たない）。
