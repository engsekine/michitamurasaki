# e2e — E2E / a11y テスト（Playwright）

service-front と admin-front の E2E・アクセシビリティ（axe-core）テストを、アプリから独立したワークスペースとしてまとめたもの。
アプリのソースは import しない（テストが必要とする値は各 `_helpers.ts` に再定義する）。

```text
e2e/
├── playwright.config.ts   # 共通設定。project = アプリ（service-front / admin-front）
├── service-front/         # ユーザー向けアプリ（http://localhost:9323）
│   ├── *.spec.ts          #   機能フロー
│   └── a11y/              #   axe-core による WCAG 2.1 AA 検証
├── admin-front/           # 運営管理画面（http://localhost:9324）
│   ├── *.spec.ts
│   └── a11y/
└── package.json
```

## 前提

1. **Supabase ローカルが起動し、seed が入っていること**（テストユーザー `test@example.com` / 上位管理者 `admin@example.com` でログインする）

    ```bash
    supabase start
    make supabase-reset
    ```

2. **各アプリの `.env`** が存在すること（`service-front/.env` / `admin-front/.env`。開発で使っているものでよい）
3. Playwright のブラウザ（初回のみ）

    ```bash
    make e2e-install          # = npm run install:browsers --workspace e2e
    ```

dev サーバーは Playwright が起動する（service-front: 9323 / admin-front: 9324）。開発用の 3000 / 3001 と衝突せず、ビルド出力も各アプリ配下の `.next-playwright/` に分離される。

## 実行

```bash
# ルートから（Makefile）
make e2e            # 両アプリすべて
make e2e-service    # service-front のみ（admin-front の dev サーバーは起動しない）
make e2e-admin      # admin-front のみ
make e2e-a11y       # 両アプリの a11y/ のみ
make e2e-ui         # UI モード

# e2e/ ディレクトリで直接
npx playwright test                                   # 全部
npx playwright test --project=admin-front             # project 指定
npx playwright test service-front/shops.spec.ts       # ファイル指定
npx playwright test -g "いいね"                        # テスト名で絞る
E2E_APP=service npx playwright test --project=service-front   # 片側の dev サーバーだけ起動
npx playwright show-report                            # 直前の HTML レポート
```

`E2E_APP`（`service` / `admin` / 両方はカンマ区切り）は **起動する dev サーバー**を絞る。`--project` はテストの絞り込みなので、片側だけ回すときは両方を指定するのが速い（`npm run test:service` / `npm run test:admin` はその組み合わせ）。

## CI

`Full Test` ワークフロー（Actions → Run workflow、手動実行）が Supabase ローカルスタックを立てて `npm run test --workspace e2e` を実行する。失敗時は `e2e/playwright-report` がアーティファクトとして保存される。

## テストを追加するとき

- 置き場所は対象アプリのディレクトリ（`service-front/` または `admin-front/`）。a11y 検証は `a11y/` 配下
- アプリのソースを import しない。定数が必要なら `_helpers.ts` に再定義し、元の場所をコメントで示す
- ログイン情報は seed（`supabase/seed.sql.template`）と一致させる
- 公開ページの a11y は `service-front/a11y/public-pages.spec.ts` が `service-front/src/app/` を走査して自動で対象に含めるため、公開ページを追加しただけなら新しい spec は不要
