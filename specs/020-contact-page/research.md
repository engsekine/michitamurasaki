# Research: お問い合わせページ

Phase 0。spec.md / clarifications の決定を実装方式へ落とし込み、未確定だった技術詳細（レート制限しきい値・送信経路・初期値補完）を確定する。

## R-001: 公開フォームの書き込み経路（RLS を閉じたまま anon に書かせる）

- **Decision**: `inquiries` テーブルへの INSERT は、`security definer` 関数 `public.submit_inquiry(...)` 経由に限定する。テーブルの RLS は SELECT / DELETE を `(select public.is_admin())` のみに閉じ、anon/authenticated への直接 INSERT ポリシーは作らない。関数に `anon, authenticated` の EXECUTE 権限を付与する。
- **Rationale**:
  - SELECT を管理者限定に保てる（FR-010 / FR-012）。直接 INSERT ポリシーだと、レート制限のために anon へ SELECT 権を開く必要が出てしまう。
  - レート制限の「直近送信数カウント」と INSERT を 1 関数内で原子的に行え、競合に強い。
  - `set search_path = ''` + 全参照のスキーマ修飾で search path injection を防ぐ（Constitution IV / sql.md）。
- **Alternatives considered**:
  - anon INSERT ポリシー + アプリ層レート制限 → カウントのため anon SELECT が必要になり SELECT を閉じられない。却下。
  - service-role キーで書き込み → service-front の Server Action は anon キー + ユーザーセッション運用。鍵を増やさない。却下。

## R-002: レート制限の方式としきい値

- **Decision**: IP 単位のレート制限を `submit_inquiry` 内で実施する。`inquiries.submitter_ip inet`（nullable）に送信元 IP を保存し、**同一 IP から直近 60 秒で 3 件以上**の送信があれば例外を送出して拒否する。加えて**同一 IP + 同一本文**が直近 5 分以内にあれば重複として拒否する（多重送信防止）。IP は Server Action で `headers()` の `x-forwarded-for` 先頭値から取得して関数に渡す。ただし XFF 先頭値はクライアントが偽装可能なため、IP ベースの制限は防御の一層にすぎない（20260702110400 で IP 非依存のレート制限を追加済み）。
- **Rationale**:
  - clarifications で「レート制限の閾値は計画フェーズで決定」とした未確定点をここで確定。低頻度の正当な利用を妨げず、bot の連投を抑える妥当な初期値。
  - IP 単位はメール詐称に強い。`inet` 型は PostgreSQL ネイティブで比較・索引が容易。
  - 重複拒否（同一本文）で「送信成功後の再送による重複」（FR-008 / Edge Case）も二重に防ぐ。
- **Alternatives considered**:
  - メール単位のみ → 送信者がメールを変えると回避可能。補助的に留める。
  - 外部レート制限（Upstash 等）→ 依存を増やす。MVP では DB 内で十分。却下。
  - IP を保存しない（揮発カウント）→ サーバーレス/マルチインスタンスで状態を共有できない。却下。
- **Note**: `submitter_ip` は管理者のみ参照可（RLS で保護）。プライバシーポリシー（spec 018 系）との整合は実装時に確認。閾値は constants と関数で同値管理する。

## R-003: ハニーポット

- **Decision**: フォームに視覚的に隠した入力 `website`（ダミー）を置き、`submitInquiry` Server Action で**値が入っていれば受付完了を返しつつ DB には保存しない**（bot をサイレントに弾く / Edge Case）。隠蔽は CSS（`sr-only` 相当 + `aria-hidden="true"` + `tabindex={-1}` + `autocomplete="off"`）で行い、スクリーンリーダー利用者に誤入力させない（Constitution V）。
- **Rationale**: 外部 CAPTCHA 無しで bot の大半を低コストに排除（clarifications で CAPTCHA 不採用が確定）。判定はサーバー側で行い、クライアント改変に依存しない。
- **Alternatives considered**: `display:none` のみ → 一部スクリーンリーダー/オートフィルで触れられる可能性。`aria-hidden` + tabindex 除外を併用する。

## R-004: 問い合わせ種別と本文上限（clarifications 反映）

- **Decision**: 種別は `'question' | 'bug' | 'request' | 'other'` の 4 値（表示ラベル「ご質問 / 不具合報告 / ご要望 / その他」）。本文は 1〜1,000 文字。これらを `service-front/src/features/contact/constants.ts` の単一定義に集約し、yup スキーマ・DB の CHECK 制約・管理表示の全てで同値を参照する。
- **Rationale**: 値（英 key）と表示（日本語ラベル）を分離（sql.md: enum 型は使わず `text + CHECK`）。DB とアプリでしきい値・選択肢を二重管理しない。
- **Alternatives considered**: PostgreSQL `enum` 型 → ALTER 困難のため `text + CHECK` を採用（sql.md）。

## R-005: ログイン中ユーザーの初期値補完（FR-013 / US3）

- **Decision**: `/contact` の Server Component で Supabase セッションを確認し、ログイン中なら `user_details`（氏名）と `auth` のメールから初期値を組み立て、`ContactForm` の `defaultValues` に渡す。未ログインは空。氏名は `last_name + first_name` を結合。値生成は `features/contact/lib/prefill.ts` に切り出し単体テストする。
- **Rationale**: 取得は Server 側（Constitution II）。補完は利便性であり、ユーザーは編集して送信できる（FR-013）。
- **Alternatives considered**: Client 側でフェッチ → Server Components First に反する。却下。

## R-006: 管理画面の閲覧・削除（既存基盤の再利用）

- **Decision**: admin-front に `inquiries-admin` feature を追加。
  - 一覧: `listResource(supabase, 'inquiries', LIST_COLUMNS, { sortableColumns: ['created_at'], searchColumns: ['name','email'], hasDeletedAt: false })` を `requireAdmin()` 後に呼ぶ。既定で `created_at` 降順（FR-011）。
  - 詳細: `getInquiryDetail(id)` で 1 行取得（`requireAdmin()`）。
  - 削除: `hardDeleteRow(supabase, 'inquiries', id, admin.id, 0)`（参照制約なしのため referencing=0）。内部で `recordAudit`（`hard_delete`）される。`revalidatePath('/inquiries')`。
  - ナビ: `AdminSidebar` の `NAV_ITEMS` に `{ href: '/inquiries', label: 'お問い合わせ' }` を追加。
- **Rationale**: 既存の汎用リソース基盤（`listResource`・`hardDeleteRow`・`requireAdmin`・`recordAudit`・`mapMutationError`）にそのまま乗るため新規コードが最小。監査ログ（spec 015 FR-018）と一貫。
- **Alternatives considered**: 専用クエリを書き下ろす → 既存パターンと乖離し重複。却下。ソフトデリート → 本機能の保持方針は「無期限保持 + 手動の物理削除」（clarifications）。`inquiries` に `deleted_at` は設けず hard delete のみ。

## R-007: 生成型（@repo/supabase）の更新

- **Decision**: マイグレーション適用後に `supabase gen types typescript --local > packages/supabase/src/database.types.ts` を実行し、`inquiries` テーブルと `submit_inquiry` 関数の型を生成する（`supabase/README.md` の手順）。両フロントは `@repo/supabase` の `Database` 型を参照する。
- **Rationale**: 型の手書きを避け、DB を単一の真実とする。`listResource` 等のジェネリクスが新テーブルでも型安全に動く。
- **Alternatives considered**: 型を手書き追記 → 生成物との乖離リスク。却下。

## R-008: 確認画面・完了（サンクス）ページ（スコープ拡張）

- **Decision**: 送信フローを「入力 → 確認 → 送信 → 完了」に拡張する。確認は `ContactForm`（Client Component）内の `step: 'input' | 'confirm'` ステップとして実装（別ルートにしない）。完了は独立ルート `/contact/complete`（Server Component）。送信成功時に `router.push('/contact/complete')`。
- **Rationale**: 確認画面はフォームの全入力値を必要とするため、別ルート化すると公開フォーム（セッション無し）では値の受け渡しが煩雑。同一コンポーネント内のステップなら RHF の状態をそのまま使え、修正で戻っても値が保持される。完了は再訪・ブックマーク・直アクセスに耐える静的ページが適切なので独立ルートにする。
- **Alternatives considered**: 確認も別ルート（`/contact/confirm`）→ 値の受け渡し（クエリ/セッション）が必要で公開フォームには過剰。却下。

## R-009: メール通知の基盤と厳密通知の実行順序（スコープ拡張）

- **Decision**: 送信成立時に **運営者通知 + 送信者への自動返信の 2 通**を **Resend（HTTP API）** で送る。env（`RESEND_API_KEY`/`CONTACT_MAIL_FROM`/`CONTACT_NOTIFY_TO`）から構成。**厳密通知**: 失敗時は受付完了としない。
  - 送信基盤は当初 SMTP（nodemailer）案だったが、Vercel のサーバーレスでは生 SMTP（ポート25 ブロック・587/465 も不安定）より **HTTP API の方が確実**なため Resend に変更。`resend.emails.send` の戻り値 `error` を検査し、非 null なら throw する（SDK は既定で throw しない）。
  - メール本文は **react-email（`@react-email/components`）の JSX テンプレート**（`features/contact/emails/InquiryNotificationEmail.tsx` / `InquiryAutoReplyEmail.tsx`）として定義し、**`@react-email/render` の `render()`** で HTML 文字列とプレーンテキスト（`{ plainText: true }`）に変換して `resend.emails.send` の `html` / `text` に渡す。本文ロジック（JSX）と送信ロジック（`email.ts`）を分離してテンプレート単体でテストする。メール HTML はクライアント制約上インラインスタイルが前提（Web の Tailwind 規約の例外）。
  - 実行順序: **(1) `submit_inquiry` で保存（レート制限・重複ガードがここで作用） → (2) 2 通送信 → (3) 送信失敗なら `discard_recent_inquiry(id)` で保存行を取り消し失敗を返す**。
- **Rationale**:
  - 保存を先に行うことで、レート制限・重複・ハニーポット（スパム）を**メール送信前に**遮断でき、bot による通知メール大量送信を防げる。
  - メール失敗時に保存行を取り消すことで、再送時に同一本文の重複ガード（5 分）へ当たって再送できなくなる問題を回避できる（厳密通知の前提）。
  - `discard_recent_inquiry` は直近 2 分・当該 id 限定。id は `submit_inquiry` の戻り値として送信者にのみ返るため第三者は対象を特定できない。
- **Alternatives considered**:
  - メール送信を先・保存を後 → ガード前にメールが飛びスパムで悪用される。却下。
  - ベストエフォート（保存成功なら完了・メール失敗は無視）→ クラリフィケーションで「厳密」を選択。却下。
  - 取り消し用に anon へ DELETE ポリシーを開放 → 任意行削除のリスク。security definer + 時間/ id 限定の関数に閉じる。
- **Note**: メール基盤（`RESEND_API_KEY` 等）未構成時は送信失敗＝完了させない（Edge Case）。本番では Resend でドメイン認証（SPF/DKIM）を行い到達性を確保する。

## まとめ（NEEDS CLARIFICATION の解消状況）

| 項目 | 状態 |
|---|---|
| 書き込み経路 / RLS | 確定（R-001: submit_inquiry RPC） |
| レート制限しきい値 | 確定（R-002: 同一 IP 60 秒 3 件 / 同一本文 5 分） |
| ハニーポット方式 | 確定（R-003） |
| 種別・本文上限 | 確定（R-004: 4 値 / 1–1,000 字） |
| ログイン補完 | 確定（R-005） |
| 管理閲覧・削除 | 確定（R-006: 既存基盤再利用・hard delete） |
| 型生成 | 確定（R-007） |
| 確認・完了画面 | 確定（R-008: 確認は in-component step / 完了は独立ルート） |
| メール通知・厳密通知順序 | 確定（R-009: Resend で 2 通 / insert→email→discard） |

未解決の NEEDS CLARIFICATION なし。Phase 1 へ進む。
