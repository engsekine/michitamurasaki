# Research: モバイルアプリ（第 1 段階）

**Date**: 2026-07-06 | **Feature**: [spec.md](./spec.md)

Technical Context に NEEDS CLARIFICATION は残っていない。以下は設計上の分岐点の決定記録。

## R1. モバイルフレームワーク

**Decision**: Expo（managed workflow）+ expo-router。

**Rationale**:
- Next.js のコードはモバイルに変換されないため、いずれにせよ UI は新規実装。Expo はビルド・OTA・ネイティブ API（SQLite / SecureStore / 共有シート / ファイル）を追加ネイティブコードなしで揃えられ、第 1 段階の要件をすべて managed の範囲で満たせる
- expo-router は App Router と同じファイルベースルーティングで、チームのメンタルモデルを共有できる
- Expo Go でシミュレータ・実機の開発検証が即時にでき、配布（EAS Build）は将来段階に先送りできる

**Alternatives considered**:
- bare React Native → ネイティブ設定の維持コストが第 1 段階の価値に見合わない
- WebView ラッパー（Capacitor 等）→ オフライン永続化・ネイティブ共有が本質要件のため不適
- PWA → iOS のストレージ永続性・オフライン制約が SC-007（消失 0 件）を満たせないリスク

## R2. 冪等転送の仕組み（FR-005 / SC-003）

**Decision**: 端末でログ作成時に UUID を採番し、それをそのまま `dives.id`（主キー）として INSERT する。23505（PK 重複）は「転送済み」として成功扱いに変換する。

**Rationale**:
- `dives` の INSERT ポリシー（`users can insert own dives`）は `user_id = auth.uid()` のみを検証するため、`id` のクライアント指定は現行 RLS のまま可能。**サーバー側の変更ゼロ**で冪等性が成立する
- 「転送成功のレスポンスを受け取る前に通信断」という最難のケースでも、再送は同じ UUID の重複となり二重登録が構造的に起きない（027 いいねの 23505 冪等変換と同じ確立済みパターン）

**Alternatives considered**:
- サーバーに冪等キーテーブルを追加 → マイグレーションが必要で、PK 重複と同じ保証を余分な部品で実現するだけ
- 内容一致による重複検知 → 同一内容の正当な複数ログ（同日同ポイント 2 本）を誤って弾く

## R3. 端末内永続化（FR-002 / SC-007）

**Decision**: expo-sqlite。`pending_dives`（転送キュー）/ `cached_dives`（サーバーコピー）/ `sync_meta`（同期時刻）の 3 テーブル。UI は常に SQLite を読む cache-first 構成。

**Rationale**:
- SQLite はトランザクションを持ち、強制終了・再起動でも書き込み済みデータが壊れない（SC-007 の根拠）。AsyncStorage は原子性が弱く、キュー用途に不向き
- 「一覧 = cached + pending の統合ビュー」を SQL で表現でき、オンライン/オフラインで描画コードを分岐させずに済む（FR-014 の状態区別もカラム 1 つ）
- オンライン時は一覧表示時に自動リフレッシュ（取得分をキャッシュへ upsert）、明示の「オフライン用に同期」で全件保証（Clarification Q2 の全件一括に対応）

**Alternatives considered**:
- AsyncStorage（JSON 直列化）→ 原子性・部分更新・クエリ性で劣り、件数増で全読み書きになる
- WatermelonDB / RxDB 等の同期フレームワーク → 双方向同期・衝突解決まで内包する大型依存。本件は「新規作成の単方向転送」に限定しており（FR-009）、自前の小さな状態機械で十分

## R4. 入力検証の共有（FR-008）

**Decision**: `dive.schema.ts`（yup・351 行）とそれが依存する定数・入力型を新設 `packages/core`（`@repo/core`）へ移動。service-front の既存ファイルは re-export に置換し、モバイルは `@repo/core` を直接 import する。

**Rationale**:
- 「Web と同等の入力検証」を写しで実現すると必ず乖離する。単一ソース化が唯一の恒久策
- re-export 方式なら service-front 側の import パス・既存テスト（dive.schema.test.ts）は無変更で、リファクタのリスクが最小

**Alternatives considered**:
- スキーマをモバイルへコピー + 一致テスト → 二重管理の恒常コスト。単一ソース化できるのにやる理由がない
- API 経由のサーバー検証のみ → オフライン作成時に即時フィードバックできず UX が劣化（圏外での保存が本件の核）

## R5. エクスポートの再利用（FR-015〜017 / Clarification Q3）

**Decision**: 既存 `GET /dives/export`（014）に `Authorization: Bearer <access_token>` 認証を追加する（cookie 認証は維持・UI 変更なし）。モバイルは expo-file-system でダウンロードし、expo-sharing で共有シートへ渡す。

**Rationale**:
- CSV / PDF の生成ロジック・ファイル名規約・項目セットを 100% 再利用でき、FR-017（Web と同等の項目）が定義上満たされる
- ルートは既に `createClient` → `getUser` で認証しており、Bearer 対応は supabase サーバークライアントへのトークン受け渡しの小変更で済む

**Alternatives considered**:
- 端末内で CSV / PDF を生成 → PDF レイアウトの二重実装。オンライン限定と確定済み（Q3）のため利点がない
- Supabase Edge Function 化 → 既存ルートの移設コストに見合う利益がない

## R6. 認証（FR-018〜020）

**Decision**: supabase-js を SecureStore アダプタ（セッション永続化）付きで使用。メール+パスワードは `signInWithPassword`、Google は expo-auth-session + ディープリンク（`mobile://auth-callback`）で PKCE フロー。ローカル DB は `user_id` で所有者を記録し、別ユーザーでのログイン時は他人のローカルデータを表示・転送しない。ログアウト時に未転送ログがあれば警告し、確認の上で端末データを削除する。

**Rationale**:
- セッション（リフレッシュトークン）を OS キーチェーンに置くことで FR-019 の保護要件を満たす
- 転送キューはセッションと独立した SQLite にあるため、トークン失効 → 再ログインでもキューは無傷（FR-020）。転送時にだけ有効なセッションを要求する

**Alternatives considered**:
- Web の cookie セッション共有 → ネイティブアプリでは成立しない（cookie は WebView 境界）
- 独自トークン保管（AsyncStorage）→ 平文保存になり FR-019 に反する

## R7. デザイントークン共有

**Decision**（実装時に更新）: `packages/ui` のトークン値（色・radius・タイポ）を `mobile/src/theme/tokens.ts` に移植し、StyleSheet で参照する。UI コンポーネント自体は共有しない（RN 専用に実装）。

**Rationale**: shadcn/Radix は DOM 専用のためコンポーネント共有は不可能。当初は NativeWind を予定したが、RN 0.86 / Expo SDK 57 との互換が未検証で、ヘッドレス環境ではビルド検証ができないため、依存を増やさないトークン移植方式へ実装時に変更した。「同一ブランド」（spec Assumption）はトークン値の同一性で担保する

**Alternatives considered**:
- NativeWind → SDK 57 対応が確認でき次第、後続段階で移行可能（tokens.ts が単一の変更点になる）
- Tamagui 等の universal UI → Web 側の全面書き換えが前提となり第 1 段階の範囲を大きく超える

## R8. 同期エンジンの駆動（Clarification Q1）

**Decision**: フォアグラウンドのみ。トリガーは 3 つ — ①アプリ起動 / フォアグラウンド復帰、②ネットワーク回復イベント（expo-network の監視）、③手動（転送待ち画面のボタン）。キューは 1 件ずつ直列処理し、失敗時は指数バックオフ（次のトリガーで再開）。

**Rationale**: 直列処理は進捗表示（SC-005）と順序保証が単純。バックグラウンド実行を持たないため OS 固有の制約対応が不要（Q1 で確定）

**Alternatives considered**: expo-background-task による定期転送 → OS による実行保証がなく検証コストが高い。第 1 段階の価値に不要と確定済み
