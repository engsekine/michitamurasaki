# daily-bonus-modal（E2E 仕様）

## 目的

デイリーボーナス獲得モーダルは「付与が実際に発生した訪問でだけ 1 回出る」ことが価値で、出過ぎれば鬱陶しく、出なければ獲得に気づけない。付与の冪等性（1 日 1 回）と組み合わさるため、単体テストでは再現しにくい「初回表示 → 遷移 → 再表示なし」と「事前付与済みでは出ない」を DB 状態を整えた上で実ブラウザで守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/dives`（認証必須ページ・付与トリガー）、`/dives/new`（「ログを書く」の遷移先）
- 関連仕様: `specs/036-daily-bonus-modal/spec.md`（FR-001 付与発生時のみ表示、FR-002 表示内容、FR-003 再表示なし、FR-004 ログ作成導線、FR-006 / SC-003 a11y、SC-002。US1 / US2）

## 前提

- 認証: 未認証（NO_AUTH）から始め、テスト内で `SERVICE_BONUS_USER`（bonus@example.com）／`SERVICE_USER`（test@example.com）にログイン
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: `SERVICE_BONUS_USER`（bonus@example.com、固定 uuid `000000b0-…-000000000005`）は seed で当日分の daily_bonus を付与していない専用ユーザー。付与は冪等（1 日 1 回）で同日 2 回目以降はモーダルが出なくなるため、**`beforeAll` で `e2e/shared/db.ts` の `revokeTodaysDailyBonus(SERVICE_BONUS_USER.email)` を実行し、当日（JST）分の `log_credit_ledger` を削除・`log_credit_balances` を減算して「未付与」状態にリセットしてから始める**（`docker exec ... psql` でローカル Supabase に直接 SQL を流す。db reset は不要）。`SERVICE_USER` など他の seed ユーザーは当日分を事前付与済み
- その他: `test.describe.configure({ mode: 'serial' })` で直列実行（bonus ユーザーの付与状態を共有するため）。`test.setTimeout(90_000)` でタイムアウト延長

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | US1+US2: 当日初回の訪問でモーダルが表示され、ログ作成へ進め、再表示されない | bonus ユーザーでログインし `/dives` を開くと dialog「デイリーボーナス獲得！」が表示され（timeout 20 秒）、「ログ枠が 1 つ増えました」「現在の残り枠: N」が見える。モーダル表示状態で axe 違反なし。「ログを書く」リンクで `/dives/new` に遷移し dialog が消える。`/dives` へ戻っても、`reload` しても dialog が再表示されない（count 0）。 |
| 2 | 事前付与済みユーザー（既存 E2E ユーザー）にはモーダルが表示されない | `SERVICE_USER` でログインし `/dives` を開いて networkidle まで待っても dialog「デイリーボーナス獲得！」が存在しない（count 0）ことを assert する。 |

## 備考

- 付与は認証必須ページ（`(authenticated)` グループ）への当日初アクセスで発生する。TOP（`/`）はグループ外のため `/dives` を起点にしている
- dev サーバーのオンデマンドコンパイル（`/dives` → `/dives/new` + React Compiler）が初回はローカル既定 30 秒に収まらないことがあるため `setTimeout(90_000)`。ダイアログは Portal 経由でハイドレーション後にマウントされるため表示待ちも 20 秒に延長
- Esc・閉じるボタンで閉じる挙動（FR-003）は単体テストで担保し、ここでは「ログを書く」導線のみ検証する
- クライアント遷移では layout が再実行されないため再表示されず（FR-003）、ハードリロードでは付与済みのため RPC が false を返して再表示されない（SC-002）
