# Feature Specification: ダイブログ CRUD

**Feature Branch**: `002-dive-log-crud`

**Created**: 2026-06-10

**Status**: Implemented

> **Note**: Out of Scope（Phase 1 対象外）としていた項目のうち、写真アップロードは [012-photo-attachments](../012-photo-attachments/spec.md)、ログのエクスポートは [014-log-export](../014-log-export/spec.md)、公開機能は [021-buddy-follow-timeline](../021-buddy-follow-timeline/spec.md) で実装済み。

**Input**: 既存仕様書からの移行

## 概要

ログインしたユーザーが自分のダイビングログを作成・閲覧・編集・削除できる。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - ダイブの詳細を記録する (Priority: P1)

ダイバーとして、潜ったダイブの詳細（潜水日・ポイント名・最大水深・潜水時間など PADI ログブック準拠の項目）を記録したい。

**Why this priority**: ログが記録できなければ他のすべての機能（一覧・編集・検索）が成立しない。本機能の中核価値。

**Independent Test**: `/dives/new` で必須 4 項目を入力して送信し、保存と詳細画面へのリダイレクトを確認することで単独でテスト可能。

**Acceptance Scenarios**:

1. **Given** 認証済みユーザーが `/dives/new` を開いている、**When** 必須項目を入力して送信する、**Then** システムは dive を保存し `/dives/[id]` にリダイレクトする
2. **Given** 認証済みユーザーが `/dives/new` を開いている、**When** 必須項目が欠けたまま送信する、**Then** システムは該当フィールドにエラーメッセージを表示する
3. **Given** 認証済みユーザーがフォームに入力している、**When** `max_depth_m` が 0 以下である、**Then** システムはエラーを表示する
4. **Given** 認証済みユーザーがフォームに入力している、**When** `bottom_time_min` が 0 以下である、**Then** システムはエラーを表示する

画面仕様: [screens/dive-new.md](screens/dive-new.md)

---

### User Story 2 - 過去のログを一覧で振り返る (Priority: P2)

ダイバーとして、過去のログを一覧で振り返り、各ログの詳細を確認したい。

**Why this priority**: 記録したログを見返すことがログブックの主目的。記録（P1）の次に重要。

**Independent Test**: 複数件のログが存在する状態で `/dives` を開き、日付降順の一覧表示・ページング・詳細画面遷移を確認することで単独でテスト可能。

**Acceptance Scenarios**:

1. **Given** 認証済みユーザーにログが存在する、**When** `/dives` を開く、**Then** システムは自分のログを日付降順で 20 件ずつ表示する
2. **Given** ログが 21 件以上ある、**When** 「もっと見る」ボタンを押す、**Then** システムは次ページを取得して表示する
3. **Given** ログが 0 件である、**When** `/dives` を開く、**Then** システムは「最初のログを記録しよう」CTA を表示する
4. **Given** 自分の dive_id がある、**When** 詳細 `/dives/[id]` を開く、**Then** システムは全項目を表示する
5. **Given** 他人の dive_id がある、**When** 詳細 `/dives/[id]` を開く、**Then** システムは 404 を返す（RLS による）
6. **Given** 詳細画面を表示している、**When** 画面を確認する、**Then** 「編集」「削除」ボタンが表示されている

画面仕様: [screens/dive-list.md](screens/dive-list.md) / [screens/dive-detail.md](screens/dive-detail.md)

---

### User Story 3 - 過去のログを編集・削除する (Priority: P3)

ダイバーとして、過去のログを編集・削除したい。

**Why this priority**: 記録・閲覧が成立した後の運用機能。入力ミスの修正や不要ログの整理に必要。

**Independent Test**: 既存ログに対して `/dives/[id]/edit` で更新、詳細画面から削除を実行し、それぞれリダイレクトと反映を確認することで単独でテスト可能。

**Acceptance Scenarios**:

1. **Given** 自分の dive_id で編集画面を開いている、**When** 編集を保存する、**Then** システムは更新し `/dives/[id]` にリダイレクトする
2. **Given** 他人の dive_id がある、**When** 編集を試みる、**Then** システムは 404 を返す（RLS による）
3. **Given** 詳細画面を表示している、**When** 削除ボタンを押し確認ダイアログで OK する、**Then** システムは dive を削除し `/dives` にリダイレクトする
4. **Given** 削除確認ダイアログが表示されている、**When** キャンセルする、**Then** システムは何もしない

画面仕様: [screens/dive-edit.md](screens/dive-edit.md) / [screens/dive-detail.md](screens/dive-detail.md)

---

### User Story 4 - 日付やポイント名でログを検索する (Priority: P4)

ダイバーとして、日付やポイント名でログを検索したい。

**Why this priority**: ログ件数が増えてから価値が出る利便性機能。一覧（P2）に対する付加機能。

**Independent Test**: 複数件のログが存在する状態で検索ボックスに条件を入力し、絞り込み結果が表示されることを確認することで単独でテスト可能。

**Acceptance Scenarios**:

1. **Given** 認証済みユーザーが `/dives` を開いている、**When** 検索ボックスに日付範囲・ポイント名を入力する、**Then** システムは絞り込んだ結果を表示する
2. **Given** 検索条件を入力している、**When** 条件に一致するログが 0 件である、**Then** システムは「条件に一致するログがありません」を表示する

画面仕様: [screens/dive-list.md](screens/dive-list.md)（検索仕様の詳細は同ファイル「5. 検索仕様」）

---

### Edge Cases

- ログが 0 件のとき → 空状態 CTA「最初のログを記録しよう」を表示する
- 検索ヒットが 0 件のとき → 「条件に一致するログがありません」を表示する
- ログが 21 件以上のとき → 「もっと見る」によるキーセットページネーションで次セットを取得する（最終ページではボタン非表示）
- 他人の dive_id / 存在しない id にアクセスしたとき → RLS により取得できず `notFound()` で 404
- `max_depth_m` が 0 以下 / `bottom_time_min` が 0 以下 → フィールド単位のバリデーションエラー
- 潜水時間の自動計算で日跨ぎ（exit < entry）のとき → +24h で計算（[screens/dive-new.md](screens/dive-new.md) 参照）
- ネットワークエラー時 → トースト通知で通知
- 削除確認ダイアログでキャンセル / Esc → 何もせずダイアログを閉じる

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムは認証済みユーザーのみに `/dives` 配下の全画面へのアクセスを許可しなければならない（未認証は `/login` へリダイレクト）
- **FR-002**: システムは `/dives` で自分のログを日付降順（`dive_date desc, id desc`）で 20 件ずつ表示しなければならない
- **FR-003**: システムはログが 21 件以上あるとき「もっと見る」ボタンで次ページを取得できなければならない（キーセットページネーション）
- **FR-004**: システムはログが 0 件のとき「最初のログを記録しよう」CTA を表示しなければならない
- **FR-005**: ユーザーはログを検索できなければならない。検索仕様は [013-dive-search-filters](../013-dive-search-filters/spec.md) の検索仕様に置換済み（`dive_date` 完全一致の初版仕様は廃止。日付範囲・深度範囲・ダイブタイプ・バディ名等の詳細は specs/013 を参照）
- **FR-006**: システムは詳細画面 `/dives/[id]` でログの全項目を表示しなければならない
- **FR-007**: システムは非公開の他人のログへのアクセス（詳細・編集）に対して 404 を返さなければならない（RLS により保証）。公開ログ（`is_public = true`）は他ユーザーも閲覧のみ可能で、編集/削除ボタンは所有者のみに表示する（021 以降）
- **FR-008**: ユーザーは必須項目（`dive_date` / `location` / `max_depth_m` / `bottom_time_min`）を入力してログを作成でき、成功時に `/dives/[id]` へリダイレクトされなければならない
- **FR-009**: システムは必須項目の欠落・`max_depth_m` ≦ 0・`bottom_time_min` < 1 をバリデーションし、該当フィールドにエラーメッセージを表示しなければならない
- **FR-010**: ユーザーは自分のログを編集でき、成功時に `/dives/[id]` へリダイレクトされなければならない
- **FR-011**: ユーザーは詳細画面の削除ボタン → 確認ダイアログの OK でログを削除でき、成功時に `/dives` へリダイレクトされなければならない。キャンセル時は何もしない
- **FR-012**: システムは保存・更新時の `user_id` をサーバー側で `auth.uid()` から強制セットしなければならない（クライアント送信値は無視）
- **FR-013**: システムは詳細画面に「編集」「削除」ボタンを表示しなければならない
- **FR-014**: フォーム・一覧・ダイアログは WCAG 2.1 AA に準拠したアクセシビリティ要件（ラベル付与、`aria-describedby` によるエラー関連付け、`role="dialog" aria-modal="true"` のフォーカストラップ、`role="list"` / `role="listitem"`、`aria-required="true"` 等）を満たさなければならない

### 必須項目

- `dive_date`（潜水日）
- `location`（ポイント名）
- `max_depth_m`（最大水深、> 0）
- `bottom_time_min`（潜水時間、≧ 1）

それ以外は任意。

### Key Entities

- **dives**: ユーザーが記録するダイビング 1 本ごとのログ。users と 1:N（`user_id`）。PADI ログブックの標準項目を踏襲し、必須 4 項目以外は任意。RLS により所有者のみ全 CRUD 可能。詳細は [data-model.md](data-model.md) を参照

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ユーザーは必須 4 項目の入力のみでログを作成し、詳細画面に到達できる
- **SC-002**: 21 件以上のログがある状態で「もっと見る」によるページングが正しく動作する（20 件単位・重複/欠落なし）
- **SC-003**: 他ユーザーの dive_id へのアクセス（詳細・編集）は 100% 404 になる（RLS の機能確認を含む）
- **SC-004**: 検索（日付・ポイント名）が動作し、条件に一致するログのみが表示される
- **SC-005**: requirements 由来の全受け入れ条件（User Story 1〜4 の Acceptance Scenarios）を満たす

## Out of Scope（Phase 1 対象外）

- 写真アップロード
- スポットマスタとの紐付け
- PDF 出力
- 公開機能（`is_public` / `public_slug` はテーブルに先行定義済みだが未使用）
- ログのエクスポート / インポート
- バディとの相互記録

## Assumptions

- 001 認証機能が完了しており、ユーザーは Supabase Auth でログインできる
- `@repo/supabase` パッケージが利用可能である
- Supabase ローカル環境が起動できる
- 公開機能（Phase 2）に備えて `is_public` / `public_slug` カラムを先行定義する（Phase 1 では使用しない）
- 想定データ量はユーザー 1 人あたり数百〜数千行（アクティブダイバーでも年間 100〜200 本程度）

## Supporting Documents

- データモデル: [data-model.md](data-model.md)
- 実装計画: [plan.md](plan.md)
- タスク: [tasks.md](tasks.md)
- 画面仕様:
  - 一覧: [screens/dive-list.md](screens/dive-list.md)
  - 詳細: [screens/dive-detail.md](screens/dive-detail.md)
  - 新規作成: [screens/dive-new.md](screens/dive-new.md)
  - 編集: [screens/dive-edit.md](screens/dive-edit.md)
