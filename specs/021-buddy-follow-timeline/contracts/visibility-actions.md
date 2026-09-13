# Contract: ログ公開/非公開トグル・編集/削除の権限（2026-07-01 改定）

`features/dives/server/actions.ts`。いずれも作成者本人のみ。

## `setDiveVisibility(diveId: string, isPublic: boolean)`

| 項目 | 内容 |
|---|---|
| 入力 | `diveId`, `isPublic` |
| 権限 | dive 所有者のみ（既存 update RLS `auth.uid() = user_id`） |
| 動作（公開化） | `is_public = true`。slug は生成しない（共有リンクは dive id ベース） |
| 動作（非公開化） | `is_public = false`。RLS が `is_public=false` を返さないため `/dives/[id]` からも即座に閲覧不可になる |
| owner 確認 | `.eq('id', diveId).eq('user_id', auth.uid()).select('id')` で owner 限定。対象が 0 件（他人/存在しない id）なら誤成功にせず `{ success: false, error: '対象のログが見つかりません' }` を返す（RLS に加えたアプリ層の二重防御） |
| 出力 | `{ success: true, isPublic }` / `{ success: false, error }` |
| 再検証 | 対象 dive 詳細（`/dives/[id]`）・一覧 |

## `updateDive(id, input)` / `deleteDive(id)` の owner 二重防御

| 項目 | 内容 |
|---|---|
| 権限 | 作成者本人のみ（update/delete RLS `auth.uid() = user_id`） |
| owner 確認 | どちらも `.eq('id', id).eq('user_id', auth.uid()).select('id')` を付け、更新/削除行数が 0 なら `{ success: false, error: '対象のログが見つかりません' }`（RLS 任せにせず 0 件を誤成功にしない） |
| 編集ページ | `/dives/[id]/edit` は `getDive`（公開ログも返る）後に `dive.userId !== user.id` なら `notFound()` |
| 詳細ページ UI | `DiveDetail` は `canManage`（`dive.userId === user.id`）でのみ編集・削除・公開設定・PDF 出力を表示 |

## 共有リンクの提示（UI・`DiveVisibilityToggle`）

公開中は共有リンクを **完全な絶対 URL**（`{SITE_URL}/dives/{diveId}`）で提示し、ユーザーが直接コピーできるようにする。閲覧は認証済みの `/dives/[id]` に統合済み（匿名共有ページは廃止）。

| 項目 | 内容 |
|---|---|
| 表示形式 | 読み取り専用の入力欄（`<input readonly>`）に絶対 URL を表示。相対パスは表示しない |
| 直接コピー | 入力欄をフォーカス/クリックで全選択でき、そのまま手動コピー可能 |
| コピーボタン | 「コピー」ボタンで同じ絶対 URL を `navigator.clipboard` に書き込む。成功時は「コピーしました」＋ `aria-live` で通知 |
| ベース URL | 正規ドメイン定数 `SITE_URL`（`NEXT_PUBLIC_SITE_URL`）を基準にする。所有者が閲覧中のホスト（`window.location.origin`）には依存しない（プレビュー URL / localhost を共有してしまうのを防ぐ）|
| ラベル | 入力欄に `共有リンク` の `<label>` を関連付け（a11y） |

## 公開範囲（FR-010・2026-07-01 改定）

| 閲覧者 | 公開ログ | 非公開ログ |
|---|---|---|
| 所有者 | ○（編集・削除・公開設定・PDF 可） | ○ |
| 認証ユーザー（`/dives/[id]`・リンク/一覧/タイムライン/検索経由） | ○（RLS `is_public=true`。全項目閲覧可・編集/削除等は不可） | ✗ |
| 匿名（未ログイン） | ✗（`/dives/[id]` は認証必須。匿名共有ページは廃止） | ✗ |

## 受け入れ基準（spec 対応）

- FR-007〜011 / SC-002（非公開漏れ 0）/ SC-005（非公開化 5 秒以内に全経路遮断）
