# Contracts: 画面・ナビゲーション・パッケージ境界

**Feature**: 029-mobile-offline-logs | **Plan**: [../plan.md](../plan.md)

## ナビゲーション（expo-router）

```text
src/app/(auth)/login.tsx      ログイン（メール / Google）。未認証時はここへゲート
src/app/(tabs)/index.tsx      ログ一覧（下部タブ: ログ）
src/app/(tabs)/new.tsx        ログ作成（下部タブ: 書く）
src/app/(tabs)/settings.tsx   設定（下部タブ: 設定）
src/app/dives/[id].tsx        ログ詳細（一覧から push）
```

下部タブは「ログ / 書く / 設定」の 3 項目（expo-router の Tabs）。

## 画面契約

### ログイン `(auth)/login`
- メール + パスワード / Google の 2 導線（FR-018）。初回はオンライン必須（spec Assumption）
- 認証成功後はセッションを SecureStore に保存し (tabs) へ

### ログ一覧 `(tabs)/index`
- データ源: SQLite（`cached_dives ∪ pending_dives` を dive_date 降順）。オフラインでも常に描画できる
- pending 由来の項目に状態バッジ（転送待ち / 失敗）を表示（FR-014）。失敗はタップで理由 + 再転送（FR-006）
- ヘッダーに同期状態（最終同期日時 / 転送待ち n 件 / 進捗）を表示（SC-005）
- 未同期端末が圏外のとき: 空状態に「オフラインで閲覧するには同期が必要」の案内（FR-013）
- オンライン時: 表示分を機会的リフレッシュ（sync-protocol.md）

### ログ作成 `(tabs)/new`
- 入力項目・検証は `@repo/core` の yup スキーマ（Web と同一 / FR-008）。エラーは項目ごとに accessibilityLabel 付きで表示
- 保存はローカル書き込みのみで完了（圏外でも成功 / SC-001）→ 一覧へ戻り「転送待ち」として表示
- オンラインなら保存直後に同期エンジンが自動転送（FR-004）

### ログ詳細 `dives/[id]`
- cached / pending どちらの由来でも同一レイアウトで表示。pending は「未転送」の明示 + 編集不可（FR-009）
- サーバー由来ログの編集・削除は第 1 段階では非対応（オンライン時も閲覧のみ。Web へ誘導）

### 設定 `(tabs)/settings`
- 「オフライン用に同期」（全件一括 / FR-011。最終同期日時を併記）
- エクスポート: 形式（CSV / PDF）と範囲を選び共有シートへ（FR-015〜016。圏外時は案内のみ / Q3）
- ログアウト: 未転送 n 件がある場合は警告 + 確認（data-model §3）

## パッケージ境界

| パッケージ | 内容 | 依存方向 |
|-----------|------|---------|
| `@repo/core`（新規） | dive の yup スキーマ・入力型・選択肢定数・INSERT 行変換 | mobile / service-front から参照される（React 非依存・純粋 TS） |
| `@repo/supabase`（既存） | Database 型 | mobile も型のみ参照 |
| `packages/ui`（既存） | Tailwind トークン | mobile の NativeWind 設定が theme を参照（コンポーネントは共有しない） |
| `mobile` | RN アプリ本体 | @repo/core / @repo/supabase に依存。service-front へは依存しない |

## service-front への変更（2 点のみ）

1. `features/dives/schemas/dive.schema.ts` → `@repo/core` からの re-export に置換（import 互換・テスト無変更）
2. `app/(authenticated)/dives/export/route.ts` → Bearer トークン認証の追加（cookie 認証は維持。014 契約に追記）

## a11y（constitution V の RN 読み替え）

- すべての操作要素: `accessibilityRole` + `accessibilityLabel`、タッチターゲット 44pt 以上
- 状態バッジは色 + テキスト（色のみに依存しない）。転送進捗は `accessibilityLiveRegion` で通知
- 動的フォントサイズ（OS 設定）に追従するレイアウト
