REPO_DIR := $(shell pwd)

CLAUDE_TARGETS := skills agents rules

.PHONY: help \
        front-setup front-up front-down front-logs front-clean \
        front-dev front-dev-https front-build front-start \
        front-lint front-lint-fix front-lint-markup \
        front-format front-format-check \
        front-check front-check-fix \
        front-type-check \
        front-test front-test-watch front-test-coverage \
        front-test-storybook front-test-e2e front-test-e2e-ui front-test-a11y front-test-all \
        front-storybook front-build-storybook front-ci-storybook \
        front-validate \
        admin-cert admin-clean-cert \
        admin-dev admin-dev-https admin-build admin-start \
        admin-type-check admin-test admin-validate \
        supabase-seed supabase-reset supabase-migration-up

## devcontainer.json に追加する mounts 設定を出力する
devcontainer:
	@rel=$$(echo "$(REPO_DIR)" | sed "s|^$(HOME)/||"); \
	printf 'Add the following "mounts" to your .devcontainer/devcontainer.json:\n\n'; \
	printf '{\n'; \
	printf '  "mounts": [\n'; \
	targets="$(CLAUDE_TARGETS)"; \
	last=$$(echo $$targets | tr ' ' '\n' | tail -1); \
	for target in $$targets; do \
		entry="\"source=\$${localEnv:HOME}/$$rel/.claude/$$target,target=/home/node/.claude/$$target,type=bind,consistency=cached\""; \
		if [ "$$target" = "$$last" ]; then \
			printf '    %s\n' "$$entry"; \
		else \
			printf '    %s,\n' "$$entry"; \
		fi; \
	done; \
	printf '  ]\n'; \
	printf '}\n'

## service-front (Docker / セットアップ系)
front-setup:
	$(MAKE) -C service-front setup

front-up:
	$(MAKE) -C service-front up

front-down:
	$(MAKE) -C service-front down

front-logs:
	$(MAKE) -C service-front logs

front-clean:
	$(MAKE) -C service-front clean

## service-front (開発)
front-dev:
	$(MAKE) -C service-front dev

front-dev-https:
	$(MAKE) -C service-front dev-https

front-build:
	$(MAKE) -C service-front build

front-start:
	$(MAKE) -C service-front start

## service-front (Lint / Format)
front-lint:
	$(MAKE) -C service-front lint

front-lint-fix:
	$(MAKE) -C service-front lint-fix

front-lint-markup:
	$(MAKE) -C service-front lint-markup

front-format:
	$(MAKE) -C service-front format

front-format-check:
	$(MAKE) -C service-front format-check

front-check:
	$(MAKE) -C service-front check

front-check-fix:
	$(MAKE) -C service-front check-fix

front-type-check:
	$(MAKE) -C service-front type-check

## service-front (Test)
front-test:
	$(MAKE) -C service-front test

front-test-watch:
	$(MAKE) -C service-front test-watch

front-test-coverage:
	$(MAKE) -C service-front test-coverage

front-test-storybook:
	$(MAKE) -C service-front test-storybook

front-test-e2e:
	$(MAKE) -C service-front test-e2e

front-test-e2e-ui:
	$(MAKE) -C service-front test-e2e-ui

front-test-a11y:
	$(MAKE) -C service-front test-a11y

front-test-all:
	$(MAKE) -C service-front test-all

front-validate:
	$(MAKE) -C service-front validate

## service-front (Storybook)
front-storybook:
	$(MAKE) -C service-front storybook

front-build-storybook:
	$(MAKE) -C service-front build-storybook

front-ci-storybook:
	$(MAKE) -C service-front ci-storybook

## admin-front (運営管理画面 / ポート 3001)
## 実体は admin-front/Makefile に定義し、ここからは委譲する（service-front と同じ構造）。
## service-front と異なり Docker を使わず npm で直接起動する。
## 同一 Supabase を共有するため、事前に `make supabase-reset`（管理者 seed 投入）が必要。
admin-cert:
	$(MAKE) -C admin-front cert

admin-clean-cert:
	$(MAKE) -C admin-front clean-cert

admin-dev:
	$(MAKE) -C admin-front dev

admin-dev-https:
	$(MAKE) -C admin-front dev-https

admin-build:
	$(MAKE) -C admin-front build

admin-start:
	$(MAKE) -C admin-front start

admin-type-check:
	$(MAKE) -C admin-front type-check

admin-test:
	$(MAKE) -C admin-front test

admin-validate:
	$(MAKE) -C admin-front validate

help:
	@echo "Usage:"
	@echo ""
	@echo "  [service-front: Docker / Setup]"
	@echo "  make front-setup            初回セットアップ"
	@echo "  make front-up               コンテナ起動（バックグラウンド）"
	@echo "  make front-down             コンテナ停止・削除（volume含む）"
	@echo "  make front-logs             コンテナログ表示"
	@echo "  make front-clean            クリーンアップ"
	@echo ""
	@echo "  [service-front: Dev]"
	@echo "  make front-dev              開発サーバー起動（HTTP）"
	@echo "  make front-dev-https        開発サーバー起動（HTTPS）"
	@echo "  make front-build            プロダクションビルド"
	@echo "  make front-start            本番サーバー起動"
	@echo ""
	@echo "  [service-front: Lint / Format]"
	@echo "  make front-lint             Biome lint"
	@echo "  make front-lint-fix         Biome lint (--write)"
	@echo "  make front-lint-markup      markuplint"
	@echo "  make front-format           Biome format (--write)"
	@echo "  make front-format-check     Biome format チェックのみ"
	@echo "  make front-check            Biome check"
	@echo "  make front-check-fix        Biome check (--write --unsafe)"
	@echo "  make front-type-check       TypeScript 型チェック"
	@echo ""
	@echo "  [service-front: Test]"
	@echo "  make front-test             単体テスト"
	@echo "  make front-test-watch       単体テスト (watch)"
	@echo "  make front-test-coverage    単体テスト + coverage"
	@echo "  make front-test-storybook   Storybook テスト"
	@echo "  make front-test-e2e         E2E テスト"
	@echo "  make front-test-e2e-ui      E2E テスト (UI モード)"
	@echo "  make front-test-a11y        a11y E2E テスト 一覧"
	@echo "  make front-test-all         単体 + E2E"
	@echo "  make front-validate         すべてのチェックを実行"
	@echo ""
	@echo "  [service-front: Storybook]"
	@echo "  make front-storybook        Storybook開発サーバー起動（http://localhost:6006）"
	@echo "  make front-build-storybook  Storybook を静的ビルド"
	@echo "  make front-ci-storybook     Storybook build + テスト (CI 用)"
	@echo ""
	@echo "  [admin-front: 運営管理画面 / ポート 3001]"
	@echo "  ※ 事前に make supabase-reset（管理者 seed 投入）が必要"
	@echo "  make admin-dev              開発サーバー起動（HTTP  / http://localhost:3001）"
	@echo "  make admin-dev-https        開発サーバー起動（HTTPS / https://localhost:3001）"
	@echo "  make admin-cert             SSL証明書を生成（admin-front/certificates/）"
	@echo "  make admin-clean-cert       SSL証明書を削除"
	@echo "  make admin-build            プロダクションビルド"
	@echo "  make admin-start            本番サーバー起動"
	@echo "  make admin-type-check       TypeScript 型チェック"
	@echo "  make admin-test             単体テスト"
	@echo "  make admin-validate         型チェック + Biome + テスト"
	@echo ""
	@echo "  [supabase]"
	@echo "  make supabase-seed          seed.sql.template を .env.local で展開して seed.sql を生成"
	@echo "  make supabase-reset         seed.sql を生成してから supabase db reset を実行"
	@echo "  make supabase-migration-up  未適用のマイグレーションをローカル DB に適用"

## supabase: seed.sql.template を envsubst で展開して seed.sql を生成
## supabase/.env.local から TEST_USER_* を読み込む
supabase-seed:
	@if [ ! -f supabase/.env.local ]; then \
		echo "Error: supabase/.env.local が見つかりません"; \
		echo "       supabase/.env.example をコピーして作成してください"; \
		exit 1; \
	fi
	@set -a; . ./supabase/.env.local; set +a; \
		envsubst '$$TEST_USER_ID $$TEST_USER_EMAIL $$TEST_USER_PASSWORD' \
		< supabase/seed.sql.template > supabase/seed.sql
	@echo "Generated supabase/seed.sql from seed.sql.template"

## supabase: seed.sql 生成 + db reset を一気に実行
supabase-reset: supabase-seed
	supabase db reset

## supabase: 未適用のマイグレーションをローカル DB に適用する
supabase-migration-up:
	supabase migration up
