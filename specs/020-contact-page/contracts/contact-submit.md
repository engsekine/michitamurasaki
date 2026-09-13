# Contract: お問い合わせ送信（公開フォーム）

service-front の Server Action `submitInquiry` と DB 関数 `submit_inquiry` の境界契約。

## Server Action: `submitInquiry`

`service-front/src/features/contact/server/actions.ts`（`'use server'`）

```text
submitInquiry(input: ContactFormValues): Promise<ActionResult>
```

- `ContactFormValues`: `{ name, email, category, body, website }`（`contact.schema.ts` の `yup.InferType`）
- 戻り値は共通 `ActionResult`（`@/shared/types/action-result`）。成功 `{ success: true }` / 失敗 `{ success: false, error }`。

### 処理フロー

1. yup でサーバー側再検証。失敗 → `actionFailure(<最初のエラーメッセージ>)`。
2. **ハニーポット**: `input.website` が空でなければ、保存せず `actionSuccess()` を返す（bot をサイレントに弾く / R-003）。
3. セッション確認: `supabase.auth.getUser()` でログイン中なら `user.id` を `p_submitter_user_id` に、なければ null。
4. IP 取得: `headers()` の `x-forwarded-for` 先頭値（無ければ null）を `p_submitter_ip` に。
5. `supabase.rpc('submit_inquiry', {...})` を呼び保存する（id を受け取る）。ガード（レート制限・重複）はこの関数内で作用。
6. 保存のエラーマッピング:
   - `rate_limited` → `actionFailure('送信が集中しています。しばらくおいてから再度お試しください')`
   - `duplicate` → `actionFailure('同じ内容のお問い合わせがすでに送信されています')`
   - その他 → `actionFailure('送信に失敗しました。時間をおいて再度お試しください')`（FR-009）
7. 通知メール送信（FR-021/022）: `sendInquiryNotifications(values)` で **運営者通知 + 送信者自動返信** の 2 通を Resend（HTTP API）で送る。
8. 厳密通知（FR-008/009/023）: メール送信に失敗したら `supabase.rpc('discard_recent_inquiry', { p_id: id })` で保存行を取り消し、`actionFailure('送信に失敗しました。時間をおいて再度お試しください')` を返す。
9. すべて成功 → `actionSuccess()`（呼び出し側 `ContactForm` が `/contact/complete` へ遷移）。

## メール送信: `sendInquiryNotifications`

`service-front/src/features/contact/server/email.ts`。Resend（HTTP API）。env: `RESEND_API_KEY` / `CONTACT_MAIL_FROM` / `CONTACT_NOTIFY_TO`。`resend.emails.send` の戻り値 `error` が非 null なら throw する。

本文は `features/contact/emails/InquiryNotificationEmail.tsx` / `InquiryAutoReplyEmail.tsx`（`@react-email/components` で構成した JSX テンプレート）を `@react-email/render` の `render()` で HTML（`html`）とプレーンテキスト（`text`・`{ plainText: true }`）に変換して渡す。

| メール | 宛先 | 主な内容 |
|---|---|---|
| 運営者通知（FR-021） | `CONTACT_NOTIFY_TO` | 氏名・メール・種別（ラベル）・本文。Reply-To = 送信者メール |
| 送信者自動返信（FR-022） | 送信者メール | 受付確認 + 入力内容の控え |

- 必須 env（`RESEND_API_KEY` / `CONTACT_MAIL_FROM` / `CONTACT_NOTIFY_TO`）が欠ける場合は throw（＝送信失敗扱い）。

### フロー / UI 契約（`ContactForm`）

`ContactForm` は `step: 'input' | 'confirm'` の 2 ステップを内部状態で持つ。送信は確認ステップでのみ実行する。

| 状態 / 操作 | 表示・挙動 |
|---|---|
| 入力ステップ「確認画面へ進む」 | yup 検証 → 通過時のみ確認ステップへ。不備は各項目に `aria-invalid` + `role="alert"`（FR-003〜005 / FR-019） |
| 確認ステップ | 入力内容を読み取り表示（種別は `inquiryCategoryLabel` で表示ラベル化、本文は `whitespace-pre-wrap`）（FR-019） |
| 確認ステップ「入力内容を修正する」 | 入力ステップへ戻す。RHF が値を保持（FR-019） |
| 送信中 | 送信ボタン無効化（`isPending`）・二重送信防止（FR-014a） |
| 送信成功 | `submitInquiry` 成功後 `router.push('/contact/complete')` で完了ページへ遷移（FR-008 / FR-020） |
| 送信失敗 | 確認ステップにとどまり `role="alert"` でエラー表示（FR-009） |

## DB 関数: `public.submit_inquiry`

詳細は [data-model.md](../data-model.md#関数-publicsubmit_inquiry) を参照。

| 入力 | 型 | 必須 |
|---|---|---|
| `p_name` | text | ○ |
| `p_email` | text | ○ |
| `p_category` | text | ○（4 値） |
| `p_body` | text | ○（1–1,000） |
| `p_submitter_user_id` | uuid | 任意（null 可） |
| `p_submitter_ip` | inet | 任意（null 可） |

| 例外（SQLSTATE/メッセージ） | 意味 |
|---|---|
| `rate_limited` | 同一 IP 直近 60 秒で 3 件以上 |
| `duplicate` | 同一 IP + 同一本文が直近 5 分以内 |
| 検証エラー | 種別/本文長/氏名長/メール長が範囲外 |

- 権限: `grant execute on function public.submit_inquiry(...) to anon, authenticated;`
- 戻り値: 作成された `inquiries.id`（uuid）。
