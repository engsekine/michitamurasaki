# sns-share（E2E 仕様）

## 目的

SNS 共有ボタン（035-sns-share-buttons）が、公開ログ詳細とプロフィールで正しい共有先 URL・定型テキストを持って表示され、非公開ログでは一切表示されないことを守る。外部サイトへの遷移は行わず、アンカーの `href` を検証することで共有先の契約（X intent / Facebook sharer）を確認する。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/dives/new`、`/dives/[id]`（ログ詳細）、`/users/taro`（自分のプロフィール）、`/users/buddy-taro`（他人のプロフィール）
- 関連仕様: `specs/035-sns-share-buttons/spec.md`（US1 / US2、FR-001 / FR-003 / FR-004 / FR-006 / FR-007、SC-003）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: seed のテストユーザー test@example.com（handle: taro）と buddy@example.com（handle: buddy-taro）。US1 のログはテスト内で作成し（ダイブ番号 9201）、テスト末尾で削除する
- その他: `test.describe.configure({ mode: 'serial' })` で直列実行（ダイブ番号の一意制約衝突を避ける）

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | US1: 公開ログ詳細で SNS 共有ボタンが動作し、非公開では表示されない | ログを非公開のまま作成すると「X で共有」リンクが無い（FR-001 / SC-003）。公開トグル ON で「X で共有」「Facebook で共有」が表示され Instagram ボタンは無い。X の `href` が `https://x.com/intent/post?` で始まり `url` に `/dives/[id]`、`text` に「SNS共有の検証のダイビングログ」を含む（FR-003 / 006 / 007）。Facebook の `href` が `sharer.php?` で始まり `u` に `/dives/[id]` を含む（FR-004）。非公開に戻すと「非公開」表示と共に共有リンクが消える。最後にログを削除する |
| 2 | US2: 自分・他人のプロフィールで SNS 共有ボタンが表示されプロフィール URL を共有できる | `/users/taro` で「X で共有」「Facebook で共有」が表示され、X intent の `url` が `/users/taro`、`text` に「のダイビングプロフィール」を含む。`/users/buddy-taro` でも「X で共有」が表示され `url` が `/users/buddy-taro` であることを assert する |

## 備考

- X / Facebook は外部サイトへ遷移するためクリックせず、`href` の検証にとどめる
- Instagram は Web 共有インテント非対応のため提供しない（2026-07-16 改定）。ボタンが存在しないことを assert する
- ダイブ番号は 92xx を使用し、social-flows（91xx）と重ねない
- ログ作成フォームは `waitForHydration` でハイドレーション完了を待ってから入力する
