# Route Contract: ランディングページ（LP）

**Date**: 2026-07-08 | **Feature**: [spec.md](./spec.md)

## 新規ルート

### `GET /lp`

| 項目 | 契約 |
|------|------|
| 認証 | 不要。未認証・認証済みのどちらでも 200 で表示（リダイレクトしない） |
| レンダリング | Server Components のみ（クライアント JS 非依存） |
| metadata | `generatePageMetadata(PAGE_DATA)`。noIndex なし（インデックス許可）、canonical `/lp`、OG/Twitter カードあり |
| 見出し構造 | `h1` × 1（ヒーロー）→ `h2`（機能紹介・料金・最下部 CTA の各セクション） |
| 必須コンテンツ | キャッチコピー / 登録 CTA（ヒーロー + 最下部の 2 箇所以上）/ 機能紹介 4 件（各画像つき）/ 料金（無料枠 + ログパック 3 種: 10 枠 480 円 / 30 枠 1,200 円 / 100 枠 3,000 円）/ ログイン導線 |
| 内部リンク | `/signup`（CTA）・`/login`・フッター経由で `/terms` `/privacy-policy` `/contact` |

## 既存ルートの不変条件（退行防止 / FR-002）

| ルート | 条件 | 期待挙動（変更なし） |
|--------|------|---------------------|
| `/` | 未認証 | `/login` へリダイレクト |
| `/` | 認証済み | ダッシュボード表示 |
| `/login` `/signup` `/reset-password` | 認証済み | `/dives` へリダイレクト |
| `proxy.ts` | — | 変更を加えない（`/lp` はデフォルト素通し） |

## 変更ファイル

| ファイル | 変更 |
|---------|------|
| `service-front/src/app/(public)/lp/page.tsx` | 新規 |
| `service-front/src/features/landing/**` | 新規 |
| `service-front/public/lp/*.png` | 新規（素材） |
| `service-front/src/app/sitemap.ts` | LP の `PAGE_DATA` を 1 エントリ追加 |

上記以外の既存ファイルは変更しない。
