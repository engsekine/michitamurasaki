# Contracts: 画面・ルート・導線

**Feature**: 027-log-likes | **Plan**: [../plan.md](../plan.md)

## ルート

| ルート | 種別 | 内容 |
|--------|------|------|
| `/likes` | 新規（authenticated） | いいねしたログ一覧。`generatePageMetadata` + Header/Footer。keyset ページング（「さらに読み込む」は 025 通知一覧と同型） |
| `/` | 変更 | タイムライン上部に `TimelineTabs`（タイムライン / いいねしたログ）を設置。「いいねしたログ」タブは `/likes` へのリンク |
| `/dives/[id]` | 変更 | 他人の公開ログに `LikeButton` を注入（`DiveDetail` の `likeAction` スロット経由）。自分のログはボタンなしで件数のみ表示 |

## コンポーネント

### `LikeButton`（新規 / `features/social/components/client/LikeButton/`）

| 項目 | 契約 |
|------|------|
| Props | `diveId: string` / `initialIsLiked: boolean` / `initialCount: number` |
| 挙動 | クリックで like/unlike をトグル。`useState` + `useTransition` の楽観的 UI、失敗時ロールバック + エラー表示（FollowButton と同型） |
| 表示 | ハートアイコン + 件数。いいね済みは塗り + 色、未いいねは輪郭のみ（色だけに依存しない / accessibility.md） |
| a11y | `<button>` / `aria-pressed`（トグル状態）/ `aria-busy`（操作中）/ アクセシブルネームは「いいね {n} 件、いいね済み」形式。タッチターゲット 44px 確保 |
| 同梱 | `LikeButton.test.tsx` + `LikeButton.stories.tsx` + index.ts（folder-structure.md） |

### `TimelineTabs`（新規 / `features/social/components/server/TimelineTabs/`）

| 項目 | 契約 |
|------|------|
| Props | `active: 'timeline' \| 'likes'` |
| 挙動 | `/`（タイムライン）と `/likes`（いいねしたログ）へのリンク 2 つをタブ表現で並べる。ページ遷移でタブが切り替わる（クライアント状態を持たない Server Component） |
| a11y | `<nav aria-label="閲覧の切り替え">` 内のリンク + 現在ページに `aria-current="page"`。タブの見た目でも下線 + 色で現在地を示す |

### `Timeline`（変更 / `features/social/components/server/Timeline/`）

- 各ログ項目に `LikeButton`（自分のログ項目は件数のみ）を追加
- 項目データは `TimelineItem.likeCount` / `likedByMe` を使用（追加フェッチしない）
- 既存テストと story を同期更新（テスト同期ルール）

### `DiveDetail`（変更 / `features/dives/components/server/DiveDetail/`）

- `likeAction?: ReactNode` スロット prop を追加し、**ヘッダー行（日付・潮回りバッジの右側）** に描画する
  （既存アクションボタン群は canManage 時のみ表示のため、他人の公開ログでも見える位置としてヘッダーを採用）
- features/dives から features/social への import はしない（app 層で注入 / R6）

### `LikedDivesList`（新規 / `features/social/components/client/LikedDivesList/`）

- `/likes` の一覧本体。Props: `initialItems: TimelineItem[]` / `initialCursor: LikedDivesCursor | null`
- いいね日時順のフラットリスト（タイムラインの日付グルーピングは使わない。並びの意味が dive_date ではないため）
- 「さらに読み込む」は `loadMoreLikedDives` Server Action で追加取得（025 NotificationList と同型）。失敗時 `role="alert"`
- 各項目はログ詳細・所有者プロフィールへのリンク + 件数表示（塗りハート + sr-only「いいね n 件」）。いいね操作は置かない（Clarification Q2）

### `Header`（変更 / `shared/components/layout/Header/`）

- メインナビゲーションに「いいね」（`/likes`）を追加（ホーム・ダイビングログに続く 3 項目目）

## 画面状態（`/likes`）

| 状態 | 表示 |
|------|------|
| 0 件 | 「いいねしたログはありません」の空状態（US2-AC4） |
| 1 頁超 | 「さらに読み込む」で次ページ追加（SC-005） |
| 項目 | タイムラインと同じログカード表現。選択でログ詳細 `/dives/[id]` へ（US2-AC2）。いいね操作は置かない（Clarification Q2） |

## 通知（既存画面への影響）

| 画面 | 変更 |
|------|------|
| 通知一覧 `/notifications` | `log_liked` が「{nickname} さんがあなたのログにいいねしました」で表示され、タップで `/dives/[id]` へ + 既読化（既存基盤。文言・遷移先の追加のみ） |
| 通知設定 `/settings/notifications` | 種別一覧に「ログにいいねされたとき」トグルが増える（既定 ON。ラベル追加のみ） |
