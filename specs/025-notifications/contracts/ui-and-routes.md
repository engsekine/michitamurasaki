# Contract: 通知の画面・ルート（service-front）

## ルート

| パス | 内容 | 認証 |
|------|------|------|
| `/notifications` | 通知一覧ページ（新規） | 必須（`(authenticated)` グループ。proxy の APP_ROUTE_PREFIXES に `/notifications` を追加） |
| `/settings/notifications` | 通知設定ページ（新規） | 必須（`/settings` プレフィックスで既に保護済み） |

両ページとも `generatePageMetadata` で metadata をエクスポートする（noIndex 不要。認証内ページ）。

## ヘッダー導線（NotificationBell / Server Component + NotificationBellPanel / Client Component）

- 設置場所: `AuthNav`（Header の actions として全認証ページに渡る）
- 表示: ベルアイコン + 未読件数バッジ。`aria-label="通知（未読 N 件）"`（0 件時は「通知」）
- 件数は `getUnreadNotificationCount()`。10 件以上は「9+」（FR-004）
- クリックでシート（`NotificationBellPanel`）が開き最新の通知（`listNotifications()` の最初のページ）を表示（feat/design-change で `/notifications` への直接遷移から変更。Clarification Q2 の変更注記を参照）
  - 通知タップは `markNotificationRead` → シートを閉じて対象へ遷移（既読化失敗でも遷移は妨げない）
  - シート下部の「すべての通知を見る」で `/notifications` へ遷移
- 未認証時は表示しない（AuthNav の既存の出し分けに従う）

## 通知一覧ページ（/notifications）

- Server Component で `ensureTimedNotifications()` → `listNotifications()` の順に実行し、初回 20 件を `NotificationList`（Client）に渡す
- 見出し: `h1`「通知」。右上に「すべて既読にする」ボタン（未読 0 件時は非活性）
- 各通知アイテム:
  - 未読は視覚的に区別（背景色 + `aria-label` に「未読」を含める。色だけに依存しない）
  - タップで `markNotificationRead(id)` 実行後に遷移先へ `router.push`（既読化の失敗は遷移を妨げない）
  - 文言テンプレート（constants.ts で管理）:
    - followed: 「{nickname} さんにフォローされました」
    - buddy_tagged: 「{nickname} さんのログにバディとして追加されました」
    - plan_reminder: 「今日はダイビング予定日です」
    - overhaul_reminder: 「レギュレーターの OH 期限が到来しました」
  - actor 退会時（actorNickname が null）: 「退会したユーザー」と表示し、リンクは無効化（FR-012）
- 「さらに読み込む」ボタンで次ページ（keyset cursor）。ロード中は `aria-busy`
- 空状態: 「通知はありません」（`role="status"` は不要。静的テキスト）

### 遷移先マップ（notificationTarget lib）

| type | 遷移先 | 対象消滅時 |
|------|--------|-----------|
| followed | `/users/{actorId}` | actorId null → リンク無効（上記） |
| buddy_tagged | `/dives/{resourceId}` | ログ削除・非公開化 → 既存ページの 404 / 表示制御に委譲 |
| plan_reminder | `/plans/{resourceId}` | 予定移動・削除済み → 既存の予定詳細 404 → `/plans` 導線に委譲 |
| overhaul_reminder | `/settings/equipment` | 機材削除済みでも設定一覧なので常に有効 |

## 通知設定ページ（/settings/notifications）

- Server Component で現在の preferences を取得し `NotificationSettings`（Client）へ
- 4 種別それぞれにトグル（`role="switch"` + `aria-checked` or checkbox。既存 EmailOptInField / TwoFactorSettings のパターンに従う）
- 変更は即時保存（`setNotificationPreference`）。保存失敗は `role="alert"`
- 既定はすべて ON（行なし = ON）。説明文で「OFF にした種別の通知は生成されず、ON に戻しても過去分は届きません」を明記（FR-011）
- 設定画面への導線: 通知一覧ページのヘッダー行に設定リンク（歯車）を置く

## コンポーネント構成（folder-structure.md 準拠・3 点 + stories）

| コンポーネント | 種別 | テスト |
|---------------|------|--------|
| `components/server/NotificationBell/` | Server | Vitest（バッジ表示分岐: 0 / 1-9 / 9+ + シート開閉・タップ既読） |
| `components/client/NotificationBellPanel/` | Client | Vitest（バッジ・シート開閉・クリッカブル判定・既読化失敗時も遷移）+ stories + a11y（シート開状態） |
| `components/client/NotificationList/` | Client | Vitest（既読操作・退会表示・追加読み込み）+ stories + a11y |
| `components/client/NotificationSettings/` | Client | Vitest（トグル・失敗表示）+ stories + a11y |

## 受け入れ対応

- US1 Acceptance 1〜5（バッジ / 一覧 / タップ既読・全既読 / 空状態 / 集約）
- US2 Acceptance 1〜3（当日予定 / OH 期限 / 移動済み予定のフォールバック）
- US3 Acceptance 1〜2（OFF で生成されない / ON 復帰で遡及しない）
