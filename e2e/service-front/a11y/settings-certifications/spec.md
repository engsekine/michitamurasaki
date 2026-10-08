# settings-certifications（E2E 仕様）

## 目的

ダイビング資格設定（`/settings/certifications` 系）の一覧・新規登録フォーム・編集画面が WCAG 2.1 AA 違反なく表示されることを守る。編集画面は動的ルートのため、テスト内で資格を 1 件登録して到達し、登録済みカードが並んだ一覧の状態も合わせて検証する。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL:
  - `/settings/certifications`（一覧。空状態・登録済みカード表示の両方）
  - `/settings/certifications/new`（新規登録フォーム）
  - `/settings/certifications/[id]/edit`（登録した資格の編集画面）
- 関連仕様: `specs/006-diving-certifications/spec.md`（FR-002 必須 3 項目、FR-003 指導団体の選択、FR-007 編集・削除と削除確認、FR-008 同一団体・ランクの重複禁止）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: テスト内で資格 1 件（指導団体 `padi`・資格ランク `a11y テスト用資格 <Date.now()>`・取得日 `2023-04-01`）を登録し、テスト末尾で削除する
- その他: なし

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | /settings/certifications 系 3 画面 - WCAG 2.1 AA 違反なし（要認証） | `/settings/certifications` をスキャン → `/settings/certifications/new` をスキャン → 指導団体・資格ランク・取得日を入力して「登録する」を押し、一覧に戻った直後（登録済みカード表示）を再スキャン → 登録したカードの「編集」リンクから `/settings/certifications/[uuid]/edit` へ遷移してスキャン。最後に一覧へ戻り、対象カードの「削除」→ dialog 内「削除する」で削除する。各画面で `expectNoViolations` により違反が無いことを検証する。 |

## 備考

- 資格ランク名は `Date.now()` を付けて実行ごとに一意にする。途中失敗で残骸が残っても「同じ団体・ランクの資格がすでに登録されています」（FR-008）で再実行不能にならないようにするため。
- 後始末の「編集」「削除」操作は `getByRole('listitem').filter({ hasText: uniqueRank })` で対象カードにスコープし、seed の資格を誤って消さない。
