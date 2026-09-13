# Contract: 管理 — お問い合わせ閲覧・削除

admin-front の `inquiries-admin` feature。既存の汎用リソース基盤（`@/shared/lib/resource/*`）を再利用する（spec 015 / contracts/admin-resource.md と整合）。

## Queries: `server/queries.ts`

```text
listInquiries(params: Pick<ListParams,'page'|'perPage'|'search'|'sort'>): Promise<ResourceListResult<InquiryListRow>>
getInquiryDetail(id: string): Promise<InquiryDetailRow | null>
```

- いずれも先頭で `await requireAdmin()`（未認証/非管理者は拒否 / FR-012）。
- `listInquiries` は `listResource(supabase, 'inquiries', LIST_COLUMNS, { ...params, searchColumns: INQUIRY_SEARCH_COLUMNS, sortableColumns: ['created_at'], hasDeletedAt: false })`。
  - `LIST_COLUMNS = 'id, name, email, category, created_at'`
  - `INQUIRY_SEARCH_COLUMNS = ['name', 'email'] as const`
  - 既定ソート: `created_at` 降順（FR-011）。一覧ページの URL パラメータ（`sort`/`dir`）から `created_at` のみ昇順/降順を切り替え可能（ソート許可列は `created_at` 単独）。
- `getInquiryDetail` は `id, name, email, category, body, submitter_user_id, submitter_ip, created_at` を `maybeSingle()` で取得。該当なしは null。

### 型

```text
InquiryListRow   = Pick<inquiries.Row, 'id'|'name'|'email'|'category'|'created_at'>
InquiryDetailRow = Pick<inquiries.Row, 'id'|'name'|'email'|'category'|'body'|'submitter_user_id'|'submitter_ip'|'created_at'>
```

型は `@repo/supabase` の生成 `Database['public']['Tables']['inquiries']['Row']` から導出。

## Actions: `server/actions.ts`

```text
deleteInquiry(id: string): Promise<ActionResult>
```

- `const admin = await requireAdmin();`
- `await hardDeleteRow(supabase, 'inquiries', id, admin.id, 0)`
  - 参照制約を持たないため referencing 件数は `0` 固定。
  - 内部で `recordAudit(supabase, admin.id, { action: 'hard_delete', targetTable: 'inquiries', targetId: id })` が実行される（spec 015 FR-018）。
- 成功時 `revalidatePath('/inquiries')` → `actionSuccess()`。失敗は `mapMutationError`。

## 画面契約

| 画面 | パス | 要素 |
|---|---|---|
| 一覧 | `/inquiries` | 受付日時（降順）・氏名・メール・種別ラベルの表。検索（氏名/メール）・ページャ。0 件は空状態「お問い合わせはありません」（US2-AC3）。各行から詳細へ遷移 |
| 詳細 | `/inquiries/[id]` | 氏名・メール・種別・本文・受付日時・（あれば）送信元 IP。削除ボタン（`DeleteInquiryButton`）。該当なしは not found |

- 本文・氏名等は React の自動エスケープに委ね、`dangerouslySetInnerHTML` を使わない（FR-015）。
- 種別 key→ラベル変換は admin 側にも定数を持つ（または `@repo/*` 共有）。表示は「ご質問 / 不具合報告 / ご要望 / その他」。
- ナビ: `AdminSidebar` の `NAV_ITEMS` に `{ href: '/inquiries', label: 'お問い合わせ' }` を追加。

## アクセス制御

- `requireAdmin()` + RLS の二層（`admins read inquiries` / `admins delete inquiries`）。非管理者は queries で例外、RLS でも 0 行/拒否（FR-012 / SC-004）。
