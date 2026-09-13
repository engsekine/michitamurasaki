# e2e — E2E / a11y テスト（Playwright）

service-front と admin-front の E2E・アクセシビリティ（axe-core）テストを、アプリから独立したワークスペースとしてまとめたもの。
アプリのソースは import しない（テストが必要とする値は `shared/` や各 `_helpers.ts` に再定義する）。

```text
e2e/
├── playwright.config.ts   # 共通設定。project = アプリ（service-front / admin-front）+ 認証 setup
├── shared/
│   ├── users.ts           #   seed のテストユーザー（資格情報の唯一の置き場）
│   └── auth.ts            #   loginWithPassword / NO_AUTH / storageState の保存先
├── service-front/         # ユーザー向けアプリ（http://localhost:9323）
│   ├── auth.setup.ts      #   ログインして storageState を保存（project "service-front:setup"）
│   ├── *.spec.ts          #   機能フロー
│   └── a11y/              #   axe-core による WCAG 2.1 AA 検証
├── admin-front/           # 運営管理画面（http://localhost:9324）
│   ├── auth.setup.ts      #   上位管理者でログインして storageState を保存
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
make e2e-watch      # watch モード（spec を保存するたびに再実行）

# e2e/ ディレクトリで直接
npx playwright test                                   # 全部
npx playwright test --project=admin-front             # project 指定
npx playwright test service-front/shops.spec.ts       # ファイル指定
npx playwright test -g "いいね"                        # テスト名で絞る
E2E_APP=service npx playwright test --project=service-front   # 片側の dev サーバーだけ起動
npx playwright show-report                            # 直前の HTML レポート
```

`E2E_APP`（`service` / `admin` / 両方はカンマ区切り）は **起動する dev サーバー**を絞る。`--project` はテストの絞り込みなので、片側だけ回すときは両方を指定するのが速い（`npm run test:service` / `npm run test:admin` はその組み合わせ）。

### watch モード（spec の保存で自動再実行）

```bash
make e2e-watch                                  # 両アプリ
npm run test:watch:service --workspace e2e      # service-front だけ（dev サーバーも片側のみ）
npm run test:watch:admin --workspace e2e
```

Playwright の watch モード（`PWTEST_WATCH=1`）で起動する。spec ファイルを保存すると **変更したファイルのテストだけ**が再実行される。ターミナルでは `Enter`（再実行）/ `q`（終了）/ `h`（ファイル名・テスト名でのフィルタ、失敗分のみ再実行、ブラウザ表示の切り替えなど追加コマンドの一覧）が使える。1 ファイル = 1 シナリオの粒度で spec を切ると、再実行の範囲が最小になる。
ブラウザで結果を見ながら回したい場合は `make e2e-ui`（UI モード）でも、ファイルごとの時計アイコンで watch を有効化できる。

## 認証（ログインは 1 回だけ）

ログインは各 spec ではなく **setup project** が行う（Playwright 公式の認証パターン）。

1. `service-front/auth.setup.ts` / `admin-front/auth.setup.ts`（project `<app>:setup`）が seed のユーザーでログインし、Cookie を `.auth/*.json`（storageState、gitignore 済み）に保存する
2. project `service-front` / `admin-front` は `dependencies` で setup に依存し、`use.storageState` でその Cookie を読み込むため、**全テストがログイン済み状態から始まる**（`npx playwright test <file>` のようにファイルを絞っても setup は先に実行される）
3. 未認証で始めたいテスト（公開ページ・ログイン画面・リダイレクトの検証）は、ファイル先頭または `test.describe` 内で打ち消す

    ```ts
    import { NO_AUTH } from '../shared/auth';
    test.use({ storageState: NO_AUTH });
    ```

4. 別ユーザーや別コンテキストでログインしたいときは `loginWithPassword(page, SERVICE_BUDDY_USER)` のように共通関数を直接呼ぶ（`browser.newContext()` で作ったコンテキストは未認証で始まる）

ユーザーの資格情報は `shared/users.ts` に集約している（seed と一致させる）。

## CI

`Full Test` ワークフロー（Actions → Run workflow、手動実行）が Supabase ローカルスタックを立てて `npm run test --workspace e2e` を実行する。失敗時は `e2e/playwright-report` がアーティファクトとして保存される。

## テストを追加するとき

- 置き場所は対象アプリのディレクトリ（`service-front/` または `admin-front/`）。a11y 検証は `a11y/` 配下
- ログイン処理は書かない（setup 済み）。未認証が前提なら `NO_AUTH`、別ユーザーなら `loginWithPassword`
- アプリのソースを import しない。定数が必要なら `shared/` か `_helpers.ts` に再定義し、元の場所をコメントで示す
- 公開ページの a11y は `service-front/a11y/public-pages.spec.ts` が `service-front/src/app/` を走査して自動で対象に含めるため、公開ページを追加しただけなら新しい spec は不要
