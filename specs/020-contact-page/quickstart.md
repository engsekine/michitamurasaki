# Quickstart: お問い合わせページ 検証ガイド

本機能をエンドツーエンドで検証する手順。実装詳細は [plan.md](./plan.md) / [contracts](./contracts) / [data-model.md](./data-model.md) を参照。

## 前提

- ローカル Supabase が起動していること（`supabase start`）。
- service-front / admin-front が起動できること（monorepo 既存手順）。
- admin_users に有効な管理者アカウントが 1 件以上あること（spec 015 のシード手順）。

## セットアップ

```bash
# 1. マイグレーション適用（inquiries テーブル + submit_inquiry 関数 + RLS）
supabase db reset            # もしくは新規マイグレーションのみ apply

# 2. 生成型を更新（inquiries / submit_inquiry を反映）
supabase gen types typescript --local > packages/supabase/src/database.types.ts

# 3. 各アプリ起動
npm run dev --workspace service-front
npm run dev --workspace admin-front
```

## シナリオ 1: 公開フォームから送信（US1 / P1）

1. 未ログイン状態で service-front の `/contact` を開く。
2. 氏名・メール・種別（4 択）・本文を入力して「確認画面へ進む」。
3. **期待**: 確認画面に入力内容が表示される（種別はラベル「ご質問」等、本文は改行保持）（FR-019）。
4. 確認画面で「入力内容を修正する」→ **入力画面に戻り、入力値が保持される**（FR-019）。
5. 確認画面で「送信する」→ **完了（サンクス）画面 `/contact/complete` に遷移**し受付メッセージが出る（FR-008 / FR-020）。
6. **メール確認**: Resend のダッシュボード（Emails ログ）で **2 通**送られたことを確認（運営通知＝`CONTACT_NOTIFY_TO` 宛・Reply-To が送信者 / 自動返信＝送信者宛）（FR-021/022）。無料枠ではドメイン未認証時、宛先が自分の検証済みアドレスに限られる点に注意。
7. 必須項目を空 / メール形式不正 / 本文 1,001 文字で「確認画面へ進む」→ **各項目にエラーが出て確認画面に進まない**（FR-003〜005）。
8. 同一内容を短時間に連投 → 2 回目以降が `rate_limited` / `duplicate` で拒否され、確認画面にエラー表示（FR-014 / R-002）。
9. **メール失敗時（厳密通知）**: `RESEND_API_KEY` を未設定にして送信 → 完了画面へ遷移せず、確認画面にエラー。保存行は取り消され、設定後の再送が重複ガードに当たらない（FR-023 / R-009）。

> 事前準備: service-front の `.env` に `RESEND_API_KEY` / `CONTACT_MAIL_FROM` / `CONTACT_NOTIFY_TO` を設定（[contracts/contact-submit.md](./contracts/contact-submit.md) 参照）。Resend でドメイン認証（SPF/DKIM）を済ませると任意宛先に送信できる。

> 検証参照: [contracts/contact-submit.md](./contracts/contact-submit.md)

## シナリオ 2: 管理画面で閲覧（US2 / P2）

1. admin-front にログイン。左ナビ「お問い合わせ」→ `/inquiries`。
2. **期待**: シナリオ 1 の送信が受付日時の新しい順で一覧表示（FR-011）。氏名/メールで検索できる。
3. 1 件の詳細を開く → 氏名・メール・種別・本文・受付日時を確認。
4. 問い合わせ 0 件のとき → 空状態「お問い合わせはありません」（US2-AC3）。

## シナリオ 3: アクセス制御（SC-004）

1. 管理者でないユーザー（または未ログイン）で `/inquiries` / `/inquiries/[id]` に直接アクセス。
2. **期待**: 閲覧が拒否される（`requireAdmin` + RLS）。

## シナリオ 4: 削除（FR-018）

1. 詳細画面で削除を実行。
2. **期待**: 一覧から消える。`admin_audit_logs` に `action='hard_delete', target_table='inquiries'` が記録される（spec 015 FR-018）。

## シナリオ 5: ログイン中の初期値補完（US3 / P3）

1. service-front にログインして `/contact` を開く。
2. **期待**: 氏名・メールがアカウント情報で初期表示され、編集して送信できる（FR-013 / R-005）。

## シナリオ 6: ハニーポット（bot 抑制 / R-003）

1. （開発時）隠し `website` フィールドに値を入れて送信。
2. **期待**: 受付完了は返るが `inquiries` には保存されない。

## 受け入れの目安（Success Criteria 対応）

- SC-001: 入力〜送信完了が 2 分以内に可能。
- SC-002: 不備入力が保存される割合 0%（DB CHECK + yup 二重防御）。
- SC-003: 送信成功分が 100% 管理一覧に出現、欠落/重複なし。
- SC-004: 非管理者の閲覧は 100% 拒否。
- SC-005: ログインユーザーは氏名/メール再入力なしで送信可。
