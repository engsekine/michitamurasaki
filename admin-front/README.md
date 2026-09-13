# admin-front

Next.js 16 を使用した運営管理画面（ポート 3001）

> リポジトリ全体の構成・サービスの起動順序は [ルートの readme](../readme.md#web-サービス全体の環境構築) を参照してください。
> service-front と**同一のローカル Supabase を共有**するため、起動には Supabase が先に立ち上がっていることが前提です（[supabase/README.md](../supabase/README.md)）。

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router) / React 19
- **言語**: TypeScript（strict）
- **スタイル**: Tailwind CSS
- **テスト**: Vitest
- **Lint / Format**: Biome

service-front と異なり **Docker を使わず npm で直接起動**します。

## クイックスタート

```bash
# 0. 依存パッケージ（リポジトリルートで 1 回。workspaces で反映される）
cd .. && npm install && cd admin-front

# 1. 管理者 seed の投入（リポジトリルートで。Supabase 起動済みであること）
cd .. && make supabase-reset && cd admin-front

# 2. 初回のみ: SSL 証明書を生成（mkcert が必要）
make cert

# 3. 開発サーバー起動
make dev          # HTTP  → http://localhost:3001
make dev-https    # HTTPS → https://localhost:3001
```

### ログイン（local 専用の管理者アカウント）

seed（`supabase/seed.sql.template`）が投入する管理者でログインします。

| 項目 | 値 |
|------|-----|
| メールアドレス | `admin@example.com` |
| パスワード | `admin-password` |

## 環境変数

`.env.example` をコピーして `.env` を作成し、Supabase の URL / anon key（`supabase status` で表示される値）を設定します。

## 主な make コマンド

`make help` で全一覧を表示できます。リポジトリルートからは `make admin-<コマンド名>` で同じものを実行できます（例: `make admin-dev`）。

| コマンド | 説明 |
|---------|------|
| `make dev` / `make dev-https` | 開発サーバー起動（3001） |
| `make build` / `make start` | プロダクションビルド / 本番サーバー起動 |
| `make check` / `make check-fix` | Biome check（`--write --unsafe` 付き修正） |
| `make type-check` | TypeScript 型チェック |
| `make test` / `make test-watch` / `make test-coverage` | Vitest 単体テスト |
| `make validate` | type-check + check + test の一括実行 |
| `make cert` / `make clean-cert` | SSL 証明書の生成 / 削除 |

## 関連ドキュメント

- リポジトリ全体の環境構築: [../readme.md](../readme.md#web-サービス全体の環境構築)
- stg / prod へのデプロイ: [../readme.md のデプロイ章](../readme.md#デプロイstg--prod)
- Supabase（マイグレーション・seed 運用）: [../supabase/README.md](../supabase/README.md)
- ユーザー向けアプリ: [../service-front/README.md](../service-front/README.md)
- アーキテクチャ / コーディング規約: `.claude/rules/`（Feature-based + shared/ 構成は service-front と共通）
