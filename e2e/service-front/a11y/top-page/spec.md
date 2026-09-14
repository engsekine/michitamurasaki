# top-page（E2E 仕様）

## 目的

TOP ダッシュボードは認証済みユーザーが最初に見る画面であり、「次の予定」カードの潮回りラベルなど多くのセクションが集まるため、支援技術ユーザーが最初に詰まる可能性が高い。ログイン済み状態で axe を走らせ、WCAG 2.1 AA 違反が持ち込まれていないことを守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/`（TOP ダッシュボード）
- 関連仕様: `specs/003-dashboard/spec.md`（FR-002 ダッシュボード構成）、`specs/007-tide-phase-display/spec.md`（「次の予定」カードの潮回りラベル）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: seed のみ
- その他: なし

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | TOP ダッシュボード - WCAG 2.1 AA 違反なし（要認証） | `/` を開き、`expectNoViolations` で axe スキャンを実行して WCAG 2.1 AA 違反が 0 件であることを assert する。 |

## 備考

- 認証必須ページのため、未認証だと `/login` へリダイレクトされて TOP 自体がスキャンされない。setup project のログイン済み storageState を前提とする
- Cookie 同意バナーが重なると axe 結果が非決定的になるため、fixture 既定の同意済みプリセットに乗る（バナー単体の a11y は `cookie-consent` が担保）
