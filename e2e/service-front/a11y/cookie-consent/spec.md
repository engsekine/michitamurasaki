# cookie-consent（E2E 仕様）

## 目的

Cookie 同意バナーは全訪問者が最初に触れる UI であり、他の a11y テストは同意済みプリセットでバナーを消した状態で走るため、バナーそのものは検証から漏れやすい。同意 Cookie 未設定でバナーが表示された状態が WCAG 2.1 AA を満たすことを守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/`（Cookie 同意バナー表示状態）
- 関連仕様: `specs/017-cookie-consent/spec.md`（SC-005 同意バナーの WCAG 2.1 AA 準拠）

## 前提

- 認証: 未認証（NO_AUTH）
- Cookie 同意: プリセットなし（cookieConsent: 'unset'）
- データ: seed のみ
- その他: テスト冒頭で `context.clearCookies()` を実行し、確実に同意 Cookie が無い状態から開始する

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | Cookie 同意バナー表示時 - WCAG 2.1 AA 違反なし | Cookie を消してトップを開き、`region`「Cookie の利用について」が表示されることを確認したうえで axe を実行し違反がないことを確認する。 |

## 備考

- fixture 既定の同意済みプリセットを `test.use({ cookieConsent: 'unset' })` で打ち消している。バナーの表示自体を検証する唯一の a11y spec のため、この打ち消しを外すとテストの意味が失われる。
- axe 実行前に `networkidle` を待っている。
