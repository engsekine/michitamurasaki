# social-flows（E2E 仕様）

## 目的

バディ・フォロー・タイムライン（021-buddy-follow-timeline）のうち、quickstart の S1 / S2 / S7 を自動化する（T052 の自動化分）。バディをフリーテキストで記録して詳細で確認できること、ログの公開トグルで共有リンクが出入りし匿名アクセスが遮断されること（SC-002 / SC-005 の安全側）、ユーザー検索からフォロー・解除できることを守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/dives/new`、`/dives/[id]`（ログ詳細）、`/users/search`、`/users/search?q=admin`、`/login`（匿名アクセス時のリダイレクト先）
- 関連仕様: `specs/021-buddy-follow-timeline/spec.md`（SC-002 / SC-005）、`specs/021-buddy-follow-timeline/quickstart.md`（S1 / S2 / S7）

## 前提

- 認証: ログイン済み（setup project の storageState）。S2 では `browser.newContext({ storageState: NO_AUTH })` で未認証（匿名）コンテキストを作り、ログインせずに公開ログ URL を開く
- Cookie 同意: 同意済みプリセット（fixture 既定）。匿名コンテキストにはプリセットしない
- データ: seed のテストユーザー test@example.com と、フォロー相手となる seed の admin ユーザー（ニックネーム admin / handle: admin-ops）。S1 / S2 のログはテスト内で作成し（ダイブ番号 9101 / 9102）、各テスト末尾で削除する
- その他: `test.describe.configure({ mode: 'serial' })` で直列実行（ダイブ番号の一意制約衝突を避ける）

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | S1: フリーテキストのバディを記録し詳細で表示できる | ログ作成フォームで「バディを追加」→「バディ名 1」に「テスト相棒」を入力して作成し、詳細に「同行バディ」と「テスト相棒」が表示されることを assert する。最後にログを削除する |
| 2 | S2: 公開で共有リンク(/dives/[id])が出て直接コピーできる → 匿名は閲覧不可 → 非公開化でリンク消滅（SC-002/005） | ログ作成後に公開トグル ON で textbox「共有リンク」が表示され値が `/dives/[id]` で終わる。未認証コンテキストで同 URL を開くと `/login` へリダイレクトされる。非公開に戻すと「非公開」表示と共に共有リンク入力が消える（SC-005）。最後にログを削除する |
| 3 | S7: ユーザー検索から相手を見つけてフォロー/解除できる | `/users/search` の searchbox「ユーザーIDで探す」に `admin` を入力して検索し、URL が `?q=admin` になりリンク「admin」と「@admin-ops」が表示される。「フォロー」→「フォロー中」に変わることを assert し、後始末で解除して「フォロー」に戻す |

## 備考

- S3〜S6 は seed データ制約（公開ログ・2 人目の非 admin ユーザー不足）のため E2E 化せず、ローカル実 DB での RLS / トリガ検証とフォロー UI の単体テスト / Story で担保する
- 匿名共有ページは廃止されており、未ログインで `/dives/[id]` を開くと `/login` へ誘導される仕様を前提にしている
- S7 は再実行耐性のため、開始時に既に「フォロー中」なら一度解除して初期状態に戻す
- ダイブ番号は 91xx を使用し、sns-share（92xx）と重ねない
- ログ作成フォームは `waitForHydration` でハイドレーション完了を待ってから入力する
