# login-page（E2E 仕様）

## 目的

管理画面（admin-front）のログインページが WCAG 2.1 AA に違反していないことを守る。未認証でアクセスできる唯一のページであり、フォームのラベル関連付けと、バリデーションエラー表示状態（role=alert）を含めて axe-core で検査する。

## 対象

- アプリ: admin-front（http://localhost:9324）
- 画面 / URL: `/login`
- 関連仕様: `specs/015-admin-panel/spec.md`（WCAG 2.1 AA 準拠は `rules/accessibility.md` と揃える）

## 前提

- 認証: 未認証（NO_AUTH）
- Cookie 同意: プリセットなし（cookieConsent: 'unset'）
- データ: seed のみ
- その他: axe はタグ `wcag2a` / `wcag2aa` / `wcag21a` / `wcag21aa` でスキャンし、`networkidle` 到達後に実行する

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | ログインページ - WCAG 2.1 AA 違反なし | `/login` を開き h1「運営管理画面ログイン」の表示を待ってから axe を実行し、violations が空であることを assert する |
| 2 | ログインページ - バリデーションエラー表示状態でも WCAG 2.1 AA 違反なし | `/login` で未入力のまま「ログイン」を押し、「メールアドレスを入力してください」が表示された状態で axe を実行し、violations が空であることを assert する（エラー文言と入力欄の関連付けを検査する） |

## 備考

- dev サーバーはオンデマンド配信のため、JS チャンク取得が落ち着く `networkidle` を待ってからスキャンする（ハイドレーション前の DOM を誤検知しない）
- Cookie 同意バナーの有無を含めて検証するため、fixture 既定の同意済みプリセットを打ち消している
