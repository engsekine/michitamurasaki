# e2e — E2E / a11y テスト（Playwright）

service-front と admin-front の E2E・アクセシビリティ（axe-core）テストを、アプリから独立したワークスペースとしてまとめたもの。
アプリのソースは import しない（テストが必要とする値は `shared/` や各 `_helpers.ts` に再定義する）。

```text
e2e/
├── playwright.config.ts   # 共通設定。project = アプリ（service-front / admin-front）+ 認証 setup
├── shared/
│   ├── test.ts            #   fixture 入りの test / expect（各 spec はここから import する）
│   ├── a11y.ts            #   expectNoViolations（axe-core / WCAG 2.1 AA）
│   ├── auth.ts            #   loginWithPassword / NO_AUTH / waitForHydration / storageState の保存先
│   ├── consent.ts         #   presetConsent（自前で作ったコンテキストに同意済み Cookie を入れる）
│   ├── db.ts              #   ローカル Supabase の DB 状態を直接リセットする（冪等な仕組みの再検証用）
│   └── users.ts           #   seed のテストユーザー（資格情報の唯一の置き場）
├── service-front/         # ユーザー向けアプリ（http://localhost:9323）
│   ├── auth.setup.ts      #   ログインして storageState を保存（project "service-front:setup"）
│   ├── <name>/            #   機能フロー。1 テスト 1 フォルダ
│   │   ├── <name>.spec.ts
│   │   ├── spec.md        #     目的・前提・シナリオ
│   │   └── changelog.md   #     変更履歴
│   └── a11y/<name>/       #   axe-core による WCAG 2.1 AA 検証（同じ 3 点セット）
├── admin-front/           # 運営管理画面（http://localhost:9324）
│   ├── auth.setup.ts      #   上位管理者でログインして storageState を保存
│   ├── <name>/
│   └── a11y/<name>/
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
npx playwright test service-front/shops               # フォルダ（= 1 テスト）指定
npx playwright test -g "いいね"                        # テスト名で絞る
E2E_APP=service npx playwright test --project=service-front   # 片側の dev サーバーだけ起動
npx playwright show-report                            # 直前の HTML レポート
```

`E2E_APP`（`service` / `admin` / 両方はカンマ区切り）は **起動する dev サーバー**を絞る。`--project` はテストの絞り込みなので、片側だけ回すときは両方を指定するのが速い（`npm run test:service` / `npm run test:admin` はその組み合わせ）。

> **同時に動かすのは 1 プロセスだけ**（CLI・UI モード・watch モード・VS Code 拡張を含む）。
> すべての実行が同じ `test-results/` を共有し、各 worker は `test-results/.playwright-artifacts-<N>/` にトレースを書く。
> 2 つの実行が並走すると worker 番号が衝突し、片方の worker 終了時のフォルダ削除でもう片方のトレースファイルが消え、
> テスト本体とは無関係な `apiRequestContext._wrapApiCall: ENOENT ... recordingN.stacks` で失敗する。
> このエラーが出たら、別ターミナルや VS Code 拡張で Playwright が動いていないか確認して片方を止め、再実行する。

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

1. `service-front/auth.setup.ts` / `admin-front/auth.setup.ts`（project `<app>:setup`）が seed のユーザーでログインし、Cookie を `.auth/*.json`（storageState、gitignore 済み）に保存する。service-front 側はログイン前に `ensureLogCredits` でテストユーザーのログ枠を 30 以上に補充する（ログを作る E2E を同日中に繰り返しても枠切れで落ちないようにするため）
2. project `service-front` / `admin-front` は `dependencies` で setup に依存し、`use.storageState` でその Cookie を読み込むため、**全テストがログイン済み状態から始まる**（`npx playwright test <file>` のようにファイルを絞っても setup は先に実行される）
3. 未認証で始めたいテスト（公開ページ・ログイン画面・リダイレクトの検証）は、ファイル先頭または `test.describe` 内で打ち消す

    ```ts
    import { NO_AUTH } from '../shared/auth';
    test.use({ storageState: NO_AUTH });
    ```

4. 別ユーザーや別コンテキストでログインしたいときは `browser.newContext({ storageState: NO_AUTH })` で未認証のコンテキストを作り、`loginWithPassword(page, SERVICE_BUDDY_USER)` のように共通関数を直接呼ぶ（`browser.newContext()` は project 既定の storageState を継承するため、明示しないとログイン済みで始まる）
5. react-hook-form のフォームは `waitForHydration(page)` を挟んでから入力する（ハイドレーション前の入力は React が初期値で上書きする。`/plans/new` `/dives/new` の作成ヘルパーで使用）

ユーザーの資格情報は `shared/users.ts` に集約している（seed と一致させる）。

## CI

`Full Test` ワークフロー（Actions → Run workflow、手動実行）が Supabase ローカルスタックを立てて `npm run test --workspace e2e` を実行する。失敗時は `e2e/playwright-report` がアーティファクトとして保存される。

## フォルダ構成と変更管理（1 テスト 1 フォルダ）

spec ファイルは単体で置かず、**専用フォルダに 3 点セット**で置く。テストの意図と変更理由がコードの隣に残り、レビュー時に「なぜこの assert があるのか」を git log を掘らずに追える。

```text
service-front/<name>/
├── <name>.spec.ts   # テスト本体
├── spec.md          # 目的・対象・前提・シナリオ表・備考（テンプレートは既存フォルダを参照）
└── changelog.md     # 変更履歴（新しいものを上。`- YYYY-MM-DD <種別>: <内容>（<関連 spec / PR / commit>）`）
```

運用ルール:

- spec.ts を変更したら **同じコミットで** `changelog.md` に 1 行追加する。シナリオ・前提が変わったら `spec.md` も直す
- 新しいテストは `<name>/` フォルダを作り、3 ファイルを揃えてから書き始める（`spec.md` を先に書くと assert の抜けに気づきやすい）
- `.claude/hooks/suggest-e2e-changelog.sh` が spec.ts の編集を検知してリマインダーを出す

## 共通 fixture / 関数（`shared/`）

| import 元 | 内容 |
|---|---|
| `shared/test` | fixture 入りの `test` / `expect`（`Page` などの型も再 export）。**各 spec は `@playwright/test` ではなくここから import する** |
| `shared/a11y` | `expectNoViolations(page)`: networkidle を待って axe-core で WCAG 2.1 AA 違反ゼロを検証 |
| `shared/auth` | `loginWithPassword` / `NO_AUTH` / `waitForHydration` |
| `shared/consent` | `presetConsent(context)`: `browser.newContext()` で自前に作ったコンテキストに同意済み Cookie を入れる |
| `shared/db` | ローカル Supabase の DB 状態を直接整える関数。`ensureLogCredits`（setup project がログ枠を補充。ログ作成は削除しても枠が戻らないため繰り返し実行で枯渇する）、`revokeTodaysDailyBonus`（1 日 1 回のボーナスを毎回検証できるよう取り消す） |
| `shared/users` | seed のテストユーザー |

fixture が既定で行うこと:

- **Cookie 同意のプリセット**: 既定コンテキストに同意済み Cookie を入れ、バナーが操作・axe スキャンに重ならないようにする。バナー自体を検証する spec は `test.use({ cookieConsent: 'unset' })` で打ち消す

## テストを追加するとき

- 置き場所は対象アプリのディレクトリ（`service-front/<name>/` または `admin-front/<name>/`）。a11y 検証は `a11y/<name>/` 配下。上記の 3 点セットを揃える
- `test` / `expect` は `shared/test` から import する（Cookie 同意のプリセットが自動で効く）
- ログイン処理は書かない（setup 済み）。未認証が前提なら `NO_AUTH`、別ユーザーなら `loginWithPassword`
- axe の検証は `expectNoViolations(page)` を使い、`AxeBuilder` を直接書かない（基準を 1 か所に保つ）
- アプリのソースを import しない。定数が必要なら `shared/` に再定義し、元の場所をコメントで示す
- 公開ページの a11y は `service-front/a11y/public-pages/` が `service-front/src/app/` を走査して自動で対象に含めるため、公開ページを追加しただけなら新しい spec は不要
