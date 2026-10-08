# login（E2E 仕様）

## 目的

管理画面（admin-front）の認証境界をスモークテストとして守る。未認証アクセスが proxy で `/login` に遮断されること、誤った資格情報ではセッションが作られずログインページに留まること、seed の上位管理者（superadmin）でログインするとダッシュボードに入れることを確認する。

## 対象

- アプリ: admin-front（http://localhost:9324）
- 画面 / URL: `/`（保護ページ・ダッシュボード）、`/login`
- 関連仕様: `specs/015-admin-panel/spec.md`、`specs/015-admin-panel/contracts/admin-auth.md`

## 前提

- 認証: 未認証（NO_AUTH）。3 本目のみテスト内で `loginWithPassword` により `ADMIN_USER`（admin@example.com・superadmin）にログインする
- Cookie 同意: プリセットなし（cookieConsent: 'unset'）
- データ: seed の superadmin ユーザー（admin@example.com）のみ
- その他: なし

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | 未認証で保護ページ（/）を開くとログインへリダイレクトされる | 未認証で `/` を開き、URL が `/login` に変わり見出し「運営管理画面ログイン」が表示されることを assert する |
| 2 | 誤ったパスワードではエラーを表示し、ログインページに留まる | `/login` で正しいメールアドレスと `wrong-password` を送信し、role=alert に「メールアドレスまたはパスワードが間違っています」が表示され pathname が `/login` のままであることを assert する |
| 3 | seed の上位管理者でログインするとダッシュボードが表示される | `loginWithPassword` で ADMIN_USER にログインし、見出し「ダッシュボード」が表示されることを assert する |

## 備考

- エラーの assert は Next.js のルートアナウンサー（role=alert）と区別するため、テキストで絞った `getByRole('alert').filter({ hasText })` を使う
- Cookie 同意バナーの有無を含めて検証するため、fixture 既定の同意済みプリセットを打ち消している
