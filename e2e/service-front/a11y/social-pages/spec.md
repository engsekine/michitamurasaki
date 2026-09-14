# social-pages（E2E 仕様）

## 目的

バディ・フォロー・タイムライン機能（021）のソーシャル UI（ログフォームの `DiveBuddyField`、ログ詳細の `DiveVisibilityToggle`、TOP タイムライン、公開プロフィールの `FollowButton` / `FollowCounts`、フォロー / フォロワー一覧の `FollowList`、ユーザー検索の `UserSearchBar`）が、空状態を含めて WCAG 2.1 AA 違反なく表示されることを守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL:
  - `/dives/new`（ログ作成フォーム。バディ行を 1 行追加した状態）
  - `/dives/[id]`（作成したログの詳細。公開トグルを表示）
  - `/`（TOP タイムライン）
  - `/users/000000ad-0000-0000-0000-000000000001`（seed の別ユーザーの公開プロフィール）
  - `/users/000000ad-0000-0000-0000-000000000001/following`（フォロー一覧）
  - `/users/000000ad-0000-0000-0000-000000000001/followers`（フォロワー一覧）
  - `/users/search?q=admin`（ユーザー検索）
- 関連仕様:
  - `specs/021-buddy-follow-timeline/spec.md`（US1 バディ記録 FR-001〜、US2 公開・非公開切替 FR-007〜、US3 フォロー FR-012〜FR-016、US4 タイムライン FR-017〜FR-021。タスク T051）
  - `specs/034-profile-user-id/spec.md`（FR-005 uuid 形式のプロフィール URL はユーザー ID の URL へ転送）

## 前提

- 認証: ログイン済み（setup project の storageState）
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ:
  - seed の別ユーザー `000000ad-0000-0000-0000-000000000001`（admin@example.com・nickname `admin`）をプロフィール / フォロー UI の表示対象および検索ヒット対象に使う
  - シナリオ 1 でダイブログ 1 件（潜水日 `2026-04-15`・ダイブ番号 `9201`・ポイント名「a11y バディ・公開トグル検証」・最大水深 18・潜水時間 40・バディ名「テストバディ」）を作成し、テスト末尾で削除する
- その他: ログ作成フォームの入力前に `waitForHydration` でクライアント側ハイドレーション完了を待つ

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | ログ作成フォーム（バディ欄）・詳細（公開トグル）- WCAG 2.1 AA 違反なし（要認証） | `/dives/new` でハイドレーションを待ち、group「同行したバディ」が表示されることを確認して「バディを追加」を押し、「バディ名 1」が表示された状態でスキャン。バディ名・潜水日・ダイブ番号・ポイント名・最大水深・潜水時間を入力して「作成する」を押し、`/dives/[uuid]` への遷移後に switch「このログを公開する」が表示されることを確認してスキャン。後始末として「削除」→ dialog 内「削除」でログを削除し `/dives` に戻ることを待つ。 |
| 2 | タイムライン・プロフィール・フォロー一覧 - WCAG 2.1 AA 違反なし（要認証） | `/` をスキャン → `/users/<OTHER_USER_ID>` で「フォロー」または「フォロー中」ボタンの表示を確認してスキャン → `/users/<OTHER_USER_ID>/following` をスキャン → `/users/<OTHER_USER_ID>/followers` をスキャン → `/users/search?q=admin` で searchbox「ユーザーIDで探す」の表示を確認してスキャン。各画面で `expectNoViolations` により違反が無いことを検証する。 |

## 備考

- バディ行は空のままだとバリデーションで送信できないため、スキャン後にバディ名を入力してから送信する。
- ダイブ番号 `9201` を明示指定し、他テストとの一意制約衝突を避ける。
- `/dives/new` は react-hook-form のフォームのため、`waitForHydration` を挟んでから入力する（ハイドレーション前の `fill` は入力が消える／追記される）。
- ユーザー検索は seed の admin ユーザーがヒットすることを前提にしている。
