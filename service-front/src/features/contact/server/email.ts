import { render } from '@react-email/render';
import { Resend } from 'resend';

import { inquiryCategoryLabel } from '../constants';
import { InquiryAutoReplyEmail } from '../emails/InquiryAutoReplyEmail';
import { InquiryNotificationEmail } from '../emails/InquiryNotificationEmail';
import type { ContactFormValues } from '../schemas/contact.schema';

/**
 * お問い合わせの通知メールを送信する（FR-021: 運営者通知 / FR-022: 送信者への自動返信）。
 * 本文は react-email の JSX テンプレートを HTML / プレーンテキストにレンダリングして送る。
 * 送信基盤は Resend（HTTP API）。Vercel のサーバーレス上で生 SMTP より安定する（research R-009）。
 * いずれかの送信に失敗した場合は throw し、呼び出し側で厳密に失敗扱いにする（FR-008/009/023）。
 */
export const sendInquiryNotifications = async (values: ContactFormValues): Promise<void> => {
    const apiKey = process.env['RESEND_API_KEY'];
    const from = process.env['CONTACT_MAIL_FROM'];
    const notifyTo = process.env['CONTACT_NOTIFY_TO'];
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
    if (!from) throw new Error('CONTACT_MAIL_FROM is not configured');
    if (!notifyTo) throw new Error('CONTACT_NOTIFY_TO is not configured');

    const resend = new Resend(apiKey);
    const categoryLabel = inquiryCategoryLabel(values.category);

    // 運営者への通知（返信先は送信者のメールにする）
    const notifyTemplate = InquiryNotificationEmail({
        name: values.name,
        email: values.email,
        categoryLabel,
        body: values.body,
    });
    const [notifyHtml, notifyText] = await Promise.all([
        render(notifyTemplate),
        render(notifyTemplate, { plainText: true }),
    ]);
    const notifyResult = await resend.emails.send({
        from,
        to: notifyTo,
        replyTo: values.email,
        // 件名に改行を含めない（メールヘッダ注入の防止。name は yup で長さのみ検証しているため）
        subject: `【お問い合わせ】${categoryLabel} - ${values.name.replace(/[\r\n]+/g, ' ')} 様`,
        html: notifyHtml,
        text: notifyText,
    });
    if (notifyResult.error) {
        throw new Error(`運営通知メールの送信に失敗しました: ${notifyResult.error.message}`);
    }

    // 送信者への自動返信
    const replyTemplate = InquiryAutoReplyEmail({ name: values.name, categoryLabel, body: values.body });
    const [replyHtml, replyText] = await Promise.all([
        render(replyTemplate),
        render(replyTemplate, { plainText: true }),
    ]);
    const replyResult = await resend.emails.send({
        from,
        to: values.email,
        subject: 'お問い合わせを受け付けました',
        html: replyHtml,
        text: replyText,
    });
    if (replyResult.error) {
        throw new Error(`自動返信メールの送信に失敗しました: ${replyResult.error.message}`);
    }
};
