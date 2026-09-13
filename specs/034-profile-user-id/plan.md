# Implementation Plan: ユーザー ID とプロフィール URL

**Branch**: `worktree-034-nickname-profile-url` | **Date**: 2026-07-12（Rev.2） | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/034-profile-user-id/spec.md`

## Summary

ユーザーが登録時に設定する英語のみの「ユーザー ID」（DB カラム名: `handle`）を新設し、プロフィール URL（`/users/[slug]`）の識別子にする。Rev.1（ニックネーム URL）の基盤 — `[slug]` ルート・uuid 転送・profilePath ヘルパー・解決 RPC・metadata 同期 — を handle 版に置き換え、ニックネームは表示名の役割に戻す（Rev.1 で入れた URL 禁則も撤去）。handle は小文字英数字 + `-` `_`（3〜30 文字・先頭英字）で保存時に小文字正規化するため、URL エンコード・予約語問題はほぼ消える。既存ユーザーはマイグレーションで `user-<uuid 先頭 8 桁>` を自動採番し、全ユーザーが必ず handle を持つ（NOT NULL・一意）。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router（React 19 + React Compiler）

**Primary Dependencies**: Supabase（PostgreSQL + Auth + RLS）/ RHF + yup。新規 npm パッケージなし

**Storage**: `user_details.handle` 追加（NOT NULL・一意・形式 CHECK・自動採番 backfill）。`handle_new_user` トリガーと `get_user_public_profiles` RPC を handle 対応に更新。解決 RPC `get_user_id_by_handle` と重複チェック `is_handle_taken` を追加。Rev.1 の `get_user_id_by_nickname` は廃止（未リリースのため Rev.1 マイグレーションはブランチから削除し、Rev.2 マイグレーションの drop if exists でローカル DB を掃除）

**Testing**: Vitest（profile-path・schema・解決・actions）/ Playwright（tests/profile-url.spec.ts を handle 版に改訂）

**Target Platform**: Web（service-front）。admin-front は対象外

**Project Type**: Web application

**Performance Goals**: handle 解決は一意インデックスを使う 1 クエリ。uuid URL は 1 リダイレクトのみ

**Constraints**: 未リリース前提で後方互換は uuid URL のみ（ニックネーム URL は廃止）。RLS 変更なし（解決・プロフィール取得は既存パターンの security definer RPC）

**Scale/Scope**: DB 1 マイグレーション・フォーム 3 つ（サインアップ / Google 補完 / 会員情報）への必須項目追加・リンク導線約 8 箇所の handle 化・E2E 改訂

## Constitution Check

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. Spec-Driven Development | PASS | spec Rev.2（Clarifications に方針転換を記録）→ 本 plan → tasks |
| II. Server Components First | PASS | Rev.1 の構成を踏襲（解決・転送は Server Component、フォームのみ client） |
| III. Test-First | PASS | handle 形式・解決・schema は単体テスト先行。E2E で登録 → URL → 変更フローを検証 |
| IV. Security & RLS by Default | PASS | RPC は `security definer` + `set search_path = ''` + `revoke ... from public` + grant authenticated のみ（Rev.1 レビューの教訓を踏襲）。handle の一意・形式は DB 制約でも担保 |
| V. Accessibility | PASS | 新フィールドは label 関連付け・`aria-invalid`・`role="alert"`。既存 a11y スイープで担保 |
| VI. Coding Standards | PASS | snake_case・CHECK 制約・単純一意インデックス。profile-path は shared/lib 規約のまま |

違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/034-profile-user-id/
├── plan.md / research.md / data-model.md / quickstart.md
├── contracts/routes-and-resolution.md
└── tasks.md
```

### Source Code（Rev.1 からの差分）

```text
supabase/migrations/
├── 20260712100000_create_get_user_id_by_nickname_fn.sql   # ★削除（Rev.1・未リリース）
└── <ts>_add_user_handle.sql                               # ★新規: handle 列 + backfill + 制約 + RPC 3 本 + トリガー更新

service-front/src/shared/lib/profile-path/    # ★改訂: handle 版（isValidHandle / normalizeHandle / profilePath({ userId, handle })）
service-front/src/shared/schemas/user-profile.ts  # ★改訂: nickname の URL 禁則を撤去し、handle フィールド（必須・形式・小文字化）を追加
service-front/src/features/social/server/queries.ts  # ★改訂: resolveProfiles（nickname+handle）/ resolveUserIdByHandle / resolveProfileSlug / requireProfileBySlug
service-front/src/app/(authenticated)/users/[slug]/  # 変更小（requireProfileBySlug のまま。canonical が handle URL に）
service-front/src/features/{social,dives,notifications,auth,account}/  # リンク生成の nickname → handle 差し替え（表示は nickname のまま）
service-front/src/features/auth/server/actions.ts    # signUp / completeProfile の入力・metadata に handle 追加
service-front/src/features/account/server/actions.ts # updateProfile: handle 更新 + metadata 同期（nickname 同期は handle 同期に置換）
supabase/seed.sql.template                            # 各テストユーザーの meta に handle 追加
service-front/tests/profile-url.spec.ts               # handle 版に改訂
```

**Structure Decision**: Rev.1 の構造（判定・生成は `shared/lib/profile-path`、解決は social queries、3 ページ共通処理は `requireProfileBySlug` + React cache）を維持し、識別子だけを nickname → handle に差し替える。表示名（nickname）とリンク（handle）が別データになるため、プロフィール要約の解決は `resolveNicknames` を `resolveProfiles`（`Map<userId, { nickname, handle }>`）に拡張し、リンクを生成する全導線へ handle を配管する。

## 設計詳細

### DB（research.md Decision 1・2）

- `user_details.handle text not null` + `check (handle ~ '^[a-z][a-z0-9_-]{2,29}$')` + 一意インデックス `user_details_handle_key`（小文字保存のため式インデックス不要）
- backfill: `'user-' || substr(replace(user_id::text, '-', ''), 1, 8)`（uuid 先頭 8 桁で実用上一意。万一の重複は一意制約違反で検出）
- `handle_new_user` トリガー: meta の `handle` を保存（欠落時は自動採番と同じ規則でフォールバック）
- RPC: `get_user_id_by_handle(p_handle)`（`lower(trim())` 正規化後の等値照合 = 一意インデックス使用）/ `is_handle_taken(p_handle, p_exclude_user_id)`（フォームの事前チェック）/ `get_user_public_profiles` を `(user_id, nickname, handle)` 返却に拡張
- すべて `security definer` + `set search_path = ''` + `revoke from public` + grant authenticated

### URL 解決（FR-001/005/007）

- slug 判別: uuid（36 文字・形式一致）→ handle 取得 → `/users/<handle>` へ転送。それ以外 → 小文字化して `get_user_id_by_handle` で解決。handle は最大 30 文字のため uuid と衝突しない
- `requireProfileBySlug`（React cache）は Rev.1 のまま。プロフィール取得（`fetchPublicProfile`）が handle も返すよう拡張

### フォーム（FR-002/003/006）

- 共有 schema `userProfileFields` に `handle` を追加（必須・形式・transform で小文字化）。nickname の Rev.1 禁則は撤去
- サインアップ・Google 補完・会員情報の 3 フォームに「ユーザー ID」欄（説明: 半角英小文字・数字・`-`・`_`、3〜30 文字。プロフィール URL に使われます）
- 重複事前チェックは `is_handle_taken`（`is_nickname_taken` と同じパターン）。DB 一意制約違反のフォールバックも同様
- auth の user_metadata に `handle` を保存・同期（サインアップ時 / completeProfile / updateProfile）。AuthNav は metadata の handle からリンク生成

## Complexity Tracking

違反なし。
