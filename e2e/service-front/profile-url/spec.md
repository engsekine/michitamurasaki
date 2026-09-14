# profile-url（E2E 仕様）

## 目的

プロフィール URL の識別子をユーザー ID（handle）に切り替えたことで、URL 解決（大文字・uuid 転送・404）とアプリ内導線・変更時の追随がすべて揃っていないと、共有済みリンクや自分のプロフィールに辿り着けなくなる。ルーティングとヘッダー導線・設定フォームを実ブラウザで通しで守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/users/{handle}`、`/users/{handle}/followers`、`/users/{handle}/following`、`/users/{uuid}`（転送元）、`/`（ヘッダーのアカウントメニュー）、`/settings/profile`（ユーザー ID 変更フォーム）
- 関連仕様: `specs/034-profile-user-id/spec.md`（FR-002 形式と小文字正規化、FR-003 予約語・重複の拒否、FR-004 導線はユーザー ID の URL、FR-005 uuid 形式の転送、FR-006 変更の即時反映と旧 ID の無効化、FR-007 404、FR-010 表示名はニックネーム、SC-004。US3、quickstart シナリオ 2・3）

## 前提

- 認証: ログイン済み（setup project の storageState、`SERVICE_USER` = handle `taro` / ニックネーム「たろう」）。シナリオ 7 のみ `browser.newContext({ storageState: NO_AUTH })` で別コンテキストを作り、テスト内で `SERVICE_RENAME_USER`（rename@example.com）にログイン
- Cookie 同意: 同意済みプリセット（fixture 既定）。シナリオ 7 の自前コンテキストは fixture 対象外のため `presetConsent(context)` を明示的に呼ぶ
- データ: seed のみ。`SERVICE_USER`（handle `taro`）、バディユーザー（固定 uuid `000000bd-…-000000000002` / handle `buddy-taro`）、リネーム専用ユーザー（固定 uuid `000000ce-…-000000000003` / handle `rename-saburo`、`SERVICE_RENAME_USER`）。シナリオ 7 は handle を `rename-shiro` に変更し、`finally` で `rename-saburo` に戻す
- その他: プロフィール更新の反映待ちは timeout 15 秒

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | ユーザー ID の URL でプロフィールが表示される（表示名はニックネームのまま） | `/users/buddy-taro` を開き、見出しに `buddy-taro` が表示されることを assert する。 |
| 2 | ヘッダーのマイプロフィールからユーザー ID の URL で遷移する | `/` で「アカウントメニューを開く」→「マイプロフィール」をクリックすると `/users/taro` に遷移し、見出し「たろう」が表示されることを assert する。 |
| 3 | followers / following もユーザー ID 基準の URL で表示される | `/users/buddy-taro/followers` で見出し「…さんのフォロワー」、`/users/buddy-taro/following` で見出し「…さんのフォロー中」が表示されることを assert する。 |
| 4 | 大文字だけが異なる URL は同一ユーザーに解決される（FR-002） | `/users/BUDDY-TARO` を開くと `buddy-taro` の見出しが表示されることを assert する。 |
| 5 | 存在しないユーザー ID・uuid の URL は 404 になる（FR-007） | `/users/no-such-user-xyz` が 404 で「お探しのページが見つかりませんでした」が表示され、`/users/00000000-0000-0000-0000-00000000dead` も 404 であることを assert する。 |
| 6 | 内部 ID（uuid）形式の URL はユーザー ID の URL へ転送される（FR-005） | `/users/<buddy uuid>` が `/users/buddy-taro` に転送されて見出しが表示され、`/users/<buddy uuid>/followers` も `/users/buddy-taro/followers` へ下層パスを維持して転送されることを assert する。 |
| 7 | ユーザー ID の変更で URL が追随し、旧 ID は無効・uuid URL は転送される（US3） | リネーム専用ユーザーで `/settings/profile` の「ユーザー ID」を `rename-shiro` に変更し「プロフィールを更新しました」を確認。`/users/rename-shiro` で見出し「rename-saburo」（ニックネーム）が表示、旧 `/users/rename-saburo` は 404、`/users/<rename uuid>` は `/users/rename-shiro` へ転送、ヘッダーの「マイプロフィール」の href が `/users/rename-shiro` になる。`finally` で `rename-saburo` に戻しコンテキストを閉じる。 |
| 8 | 不正な形式・予約語への変更は拒否される（FR-002・003） | `/settings/profile` で `a/b` → 形式エラー文、`search` → 「このユーザー ID は使用できません」、`buddy-taro`（他人の ID）→ 「このユーザー ID は既に使われています。…」がそれぞれ表示されることを assert する。 |

## 備考

- `changeHandle` は入力欄が既に目的の値なら送信をスキップする。同値のままでは「更新する」が disabled でクリックできず、前回実行の中断後に再実行不能になるのを防ぐため
- リネーム専用ユーザーを分離しているのは、他テストのプロフィール URL 前提（`taro` / `buddy-taro`）を壊さないため
- シナリオ 7 は `page` fixture ではなく `browser.newContext` を使うため、fixture の同意プリセットが効かず `presetConsent` を直接呼んでいる
- 登録フォームの形式・重複エラー（quickstart シナリオ 1）は schema / form の単体テストで担保し、ここでは扱わない
