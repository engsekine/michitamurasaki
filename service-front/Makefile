.PHONY: help setup cert clean clean-cert \
        up down logs \
        dev dev-https build start \
        lint lint-fix lint-markup \
        format format-check \
        check check-fix \
        type-check \
        test test-watch test-coverage \
        test-storybook test-all \
        storybook build-storybook ci-storybook \
        validate

COMPOSE := docker compose -f docker-compose.dev.yml
SERVICE := app

## ヘルプ表示
help:
	@echo "Usage:"
	@echo ""
	@echo "  [Docker]"
	@echo "  make up              コンテナ起動（バックグラウンド）"
	@echo "  make down            コンテナ停止・削除"
	@echo "  make logs            コンテナログ表示"
	@echo ""
	@echo "  [開発]"
	@echo "  make dev             開発サーバー起動（HTTP）"
	@echo "  make dev-https       開発サーバー起動（HTTPS）"
	@echo "  make build           プロダクションビルド"
	@echo "  make start           本番サーバー起動"
	@echo ""
	@echo "  [Lint / Format]"
	@echo "  make lint            Biome lint"
	@echo "  make lint-fix        Biome lint (--write)"
	@echo "  make lint-markup     markuplint"
	@echo "  make format          Biome format (--write)"
	@echo "  make format-check    Biome format チェックのみ"
	@echo "  make check           Biome check"
	@echo "  make check-fix       Biome check (--write --unsafe)"
	@echo "  make type-check      TypeScript 型チェック"
	@echo ""
	@echo "  [Test]"
	@echo "  make test            単体テスト"
	@echo "  make test-watch      単体テスト (watch)"
	@echo "  make test-coverage   単体テスト + coverage"
	@echo "  make test-storybook  Storybook テスト"
	@echo "  make test-all        単体 + Storybook（E2E はルートの make e2e）"
	@echo "  make validate        type-check + lint + test"
	@echo ""
	@echo "  [Storybook]"
	@echo "  make storybook       Storybook 開発サーバー起動（http://localhost:6006）"
	@echo "  make build-storybook Storybook を静的ビルド"
	@echo "  make ci-storybook    Storybook build + テスト (CI 用)"
	@echo ""
	@echo "  [セットアップ]"
	@echo "  make setup           初回セットアップ（npm install + SSL証明書生成）"
	@echo "  make cert            SSL証明書を生成"
	@echo "  make clean           node_modules と証明書を削除"

## コンテナ起動（バックグラウンド）
up:
	$(COMPOSE) up -d --build

## コンテナ停止・削除（anonymous volume も削除）
down:
	$(COMPOSE) down -v

## コンテナログ表示
logs:
	$(COMPOSE) logs -f $(SERVICE)

## 初回セットアップ
setup: cert
	@echo "📦 Installing dependencies..."
	$(COMPOSE) run --rm $(SERVICE) npm install
	@echo "✅ Setup complete!"
	@echo ""
	@echo "次のステップ:"
	@echo "  make dev-https  # HTTPS開発サーバー起動"

## SSL証明書を生成
cert:
	@echo "🔐 Generating SSL certificates..."
	@if ! command -v mkcert > /dev/null; then \
		echo "❌ Error: mkcert is not installed."; \
		echo ""; \
		echo "Install mkcert:"; \
		echo "  macOS:   brew install mkcert"; \
		echo "  Windows: choco install mkcert"; \
		echo "  Linux:   See README.md"; \
		exit 1; \
	fi
	@if [ ! -f "$(HOME)/.local/share/mkcert/rootCA.pem" ] && [ ! -f "$(HOME)/Library/Application Support/mkcert/rootCA.pem" ]; then \
		echo "Installing mkcert root CA..."; \
		mkcert -install; \
	fi
	@mkdir -p certificates
	@if [ -f certificates/localhost.pem ]; then \
		echo "⚠️  certificates/localhost.pem already exists. Skipping certificate generation."; \
		echo "   To regenerate, run: make clean-cert && make cert"; \
	else \
		mkcert -cert-file certificates/localhost.pem -key-file certificates/localhost-key.pem localhost 127.0.0.1 ::1; \
		echo "✅ SSL certificates generated:"; \
		echo "   - certificates/localhost.pem"; \
		echo "   - certificates/localhost-key.pem"; \
	fi

## SSL証明書のみ削除
clean-cert:
	@echo "🗑️  Removing SSL certificates..."
	rm -f certificates/localhost*.pem
	@echo "✅ Certificates removed."

## すべてクリーンアップ
clean: clean-cert down
	@echo "🗑️  Removing build artifacts..."
	$(COMPOSE) down --volumes --rmi local
	@echo "✅ Clean complete."

## 開発サーバー起動（HTTP）
dev:
	$(COMPOSE) run --rm --service-ports $(SERVICE) npm run dev

## 開発サーバー起動（HTTPS）
dev-https:
	@if [ ! -f certificates/localhost.pem ]; then \
		echo "❌ SSL certificate not found. Running 'make cert'..."; \
		$(MAKE) cert; \
	fi
	$(COMPOSE) up --build -d

## プロダクションビルド
## docker-compose.dev.yml で NODE_ENV=development を設定しているため、
## ビルド時のみ NODE_ENV=production で上書きする（Next.js の非標準 NODE_ENV 警告と
## ReactQueryDevtools の production バンドルへの混入を防ぐ）。
build:
	$(COMPOSE) exec -e NODE_ENV=production $(SERVICE) npm run build

## 本番サーバー起動
start:
	$(COMPOSE) exec $(SERVICE) npm run start

## Lint 実行
lint:
	$(COMPOSE) exec $(SERVICE) npm run lint

## Lint auto-fix
lint-fix:
	$(COMPOSE) exec $(SERVICE) npm run lint:fix

## markuplint
lint-markup:
	$(COMPOSE) exec $(SERVICE) npm run lint:markup

## フォーマット実行
format:
	$(COMPOSE) exec $(SERVICE) npm run format

## フォーマットチェック
format-check:
	$(COMPOSE) exec $(SERVICE) npm run format:check

## Biome check
check:
	$(COMPOSE) exec $(SERVICE) npm run check

## Biome check (--write --unsafe)
check-fix:
	$(COMPOSE) exec $(SERVICE) npm run check:fix

## 型チェック
type-check:
	$(COMPOSE) exec $(SERVICE) npm run type-check

## 単体テスト
test:
	$(COMPOSE) exec $(SERVICE) npm run test

## 単体テスト (watch モード)
test-watch:
	$(COMPOSE) exec $(SERVICE) npm run test:watch

## 単体テスト + coverage
test-coverage:
	$(COMPOSE) exec $(SERVICE) npm run test:coverage

## Storybook テスト
test-storybook:
	$(COMPOSE) exec $(SERVICE) npm run test:storybook

## 単体 + Storybook をまとめて実行（E2E はアプリから独立した e2e/ ワークスペースへ移行。ルートで `make e2e`）
test-all:
	$(COMPOSE) exec $(SERVICE) npm run test:all

## すべてのチェックを実行（type-check + lint + test）
validate:
	$(COMPOSE) exec $(SERVICE) npm run validate

## Storybook開発サーバー起動（http://localhost:6006）
storybook:
	$(COMPOSE) run --rm -p 6006:6006 $(SERVICE) npm run storybook

## Storybookを静的ビルド
build-storybook:
	$(COMPOSE) exec $(SERVICE) npm run build-storybook

## Storybook build + テスト（CI 用）
ci-storybook:
	$(COMPOSE) exec $(SERVICE) npm run ci:storybook
