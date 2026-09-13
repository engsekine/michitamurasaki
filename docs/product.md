# ダイビングログアプリ プロダクト方針

Web 上でダイビングのログ（ログブック）を作成・管理できるアプリ。

## 1. 開発フェーズ

### Phase 1（MVP）

- 001 認証
- 002 ログ機能（CRUD）
- 003 ダッシュボード（TOP / 累計統計 / レギュレーター OH）
- 004 TOP 拡張（ダイビング予定 / 持ち物リスト）

### Phase 2

- 005 PDF 出力
- 006 公開機能

### 将来構想

- ダイビングスポット API（スポットマスタとログの紐付け）
- マネタイズ
  - 海洋データ（海水温など）の販売
  - ~~ログブック追加課金~~ → **実装済み（026-log-monetization）**: ログ枠制 + デイリーボーナス（1 日 1 枠）+ 買い切りログパック（お試し 10 枠 480 円 / おすすめ 30 枠 1,200 円 / たっぷり 100 枠 3,000 円 / Stripe Checkout）
  - ~~広告バナー設置~~ → **廃止**（026 で「広告なし」を恒久方針として明文化。収益はログパックの買い切り販売のみ）

## 2. 技術スタック

既存の `service-front` を流用する。

| 領域 | 採用技術 |
|------|---------|
| フレームワーク | Next.js 16（App Router） |
| 言語 | TypeScript（strict） |
| UI | Tailwind CSS, shadcn/ui, Base UI |
| フォーム | react-hook-form + yup |
| データ取得 | TanStack Query（クライアント側）/ Server Components（サーバー側） |
| BaaS | Supabase（Auth, Database, Storage） |
| Supabase クライアント | `@repo/supabase`（共有パッケージ） |
| テスト | Jest, Playwright |

## 3. ディレクトリ構成

`service-front` の Feature-based アーキテクチャに従う。

```
service-front/src/
├── app/
│   ├── (auth)/        # 認証関連ルート（未認証アクセス可）
│   ├── (app)/         # 認証必須のアプリルート
│   └── api/
├── features/
│   ├── auth/
│   └── dives/
└── shared/
```

## 4. 非機能要件

- アクセシビリティ: WCAG 2.1 AA 準拠（`rules/accessibility.md`）
- レスポンシブ: モバイルファースト（タッチターゲット 44×44px 以上）
- セキュリティ: Supabase RLS で他ユーザーのデータに触れない
- パフォーマンス: 一覧 1 ページ 20 件、画像は遅延読み込み

## 5. 仕様書の構成（Spec-Driven Development）

仕様書は用途に応じて 2 種類に分けて管理する。

- `specs/features/<連番>-<機能名>/` — 機能単位（実装順）
- `specs/screens/<画面名>.md` — 画面単位（横断的な参照ドキュメント）

機能仕様は以下 3 ファイルを置く。

| ファイル | 内容 |
|---------|------|
| `requirements.md` | 受け入れ条件（WHAT / WHY） |
| `design.md` | 技術設計（HOW: データモデル / API / 画面） |
| `tasks.md` | 実装タスク（DO: チェックボックス） |

### 機能仕様一覧

| ID | 機能 | フェーズ | パス |
|----|------|---------|------|
| 001 | 認証 | Phase 1 | `specs/001-auth/` |
| 002 | ログ CRUD | Phase 1 | `specs/002-dive-log-crud/` |
| 003 | ダッシュボード | Phase 1 | `specs/003-dashboard/` |
| 004 | ダイビング予定 / 持ち物リスト | Phase 1 | `specs/004-top-dive-plans/` |
| 005 | PDF 出力 | Phase 2 | 未作成 |
| 006 | 公開機能 | Phase 2 | 未作成 |

### 運用ルール

- 実装前に `requirements.md` → `design.md` → `tasks.md` の順で書く
- 実装中に決まった仕様は逐次反映する（Living Document）
- AI への指示は「`specs/features/002-dive-log-crud/tasks.md` の T5 をやって」のようにファイル + タスク番号で指定する
- 画面単位の仕様（項目定義・遷移・状態）は `specs/screens/<画面名>.md` に分離し、対応する機能仕様からリンクで紐付ける
