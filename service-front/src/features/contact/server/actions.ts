'use server';

import { headers } from 'next/headers';
import { ValidationError } from 'yup';

import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

import { type ContactFormValues, contactSchema } from '../schemas/contact.schema';
import { sendInquiryNotifications } from './email';

/** x-forwarded-for の先頭値を送信元 IP とみなす（無ければ null） */
const resolveClientIp = (forwardedFor: string | null): string | null => {
    if (!forwardedFor) return null;
    const first = forwardedFor.split(',')[0]?.trim();
    return first && first.length > 0 ? first : null;
};

/**
 * お問い合わせ送信（公開・ログイン不要 / US1）。
 * ハニーポット判定後、security definer 関数 submit_inquiry 経由で保存する（research R-001/R-003）。
 * 書き込みは関数 1 経路に閉じ、テーブルの SELECT は管理者限定のまま保つ。
 */
export const submitInquiry = async (input: ContactFormValues): Promise<ActionResult> => {
    // サーバー側でも再検証（クライアント改変への防御）
    let values: ContactFormValues;
    try {
        values = await contactSchema.validate(input, { abortEarly: false });
    } catch (error) {
        if (error instanceof ValidationError) return actionFailure(error.errors[0] ?? '入力内容を確認してください');
        return actionFailure('入力内容を確認してください');
    }

    // ハニーポットに値があれば bot とみなし、保存せず受付完了を返す（R-003）
    if (values.website.trim() !== '') return actionSuccess();

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const headerList = await headers();
    const ip = resolveClientIp(headerList.get('x-forwarded-for'));

    // 1) 保存（レート制限・重複ガードはこの関数内で実行される）
    // 生成 Args は nullable 引数も非 null 型で表現されるため、null 許容の値はここで型境界を閉じる
    const { data: inquiryId, error } = await supabase.rpc('submit_inquiry', {
        p_name: values.name,
        p_email: values.email,
        p_category: values.category,
        p_body: values.body,
        p_submitter_user_id: (user?.id ?? null) as string,
        p_submitter_ip: ip,
    });

    if (error) {
        const message = error.message ?? '';
        if (message.includes('rate_limited')) {
            return actionFailure('送信が集中しています。しばらくおいてから再度お試しください');
        }
        if (message.includes('duplicate')) {
            return actionFailure('同じ内容のお問い合わせがすでに送信されています');
        }
        console.error('[submitInquiry] rpc error:', { message: error.message, code: error.code });
        return actionFailure('送信に失敗しました。時間をおいて再度お試しください');
    }

    // 2) 通知メール送信（運営通知 + 送信者への自動返信）。
    //    厳密通知（FR-008/009）: 送信に失敗したら保存済みの行を取り消し、失敗を返す。
    //    取り消すことで、再送時に同一本文の重複ガードへ当たるのを防ぐ。
    try {
        await sendInquiryNotifications(values);
    } catch (mailError) {
        console.error('[submitInquiry] mail error:', mailError);
        if (inquiryId) {
            // 送信者メールを添えて「同一メールの直近行」のみ取り消せるようにする（ID だけで他人の行を消せない）
            const { error: discardError } = await supabase.rpc('discard_recent_inquiry', {
                p_id: inquiryId,
                p_email: values.email,
            });
            if (discardError) console.error('[submitInquiry] discard error:', discardError);
        }
        return actionFailure('送信に失敗しました。時間をおいて再度お試しください');
    }

    return actionSuccess();
};
