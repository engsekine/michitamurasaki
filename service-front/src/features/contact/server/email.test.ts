import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContactFormValues } from '../schemas/contact.schema';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('resend', () => ({
    Resend: class {
        emails = { send };
    },
}));

// react-email のレンダリングはテンプレート側テストで検証する。ここでは送信オーケストレーションに集中する。
// plainText オプションの有無で戻り値を変え、html / text が別経路でレンダリングされることを担保する。
vi.mock('@react-email/render', () => ({
    render: vi
        .fn()
        .mockImplementation((_template, options) =>
            Promise.resolve(options?.plainText ? 'plain text' : '<html>rendered</html>'),
        ),
}));

import { sendInquiryNotifications } from './email';

const values: ContactFormValues = {
    name: '山田太郎',
    email: 'taro@example.com',
    category: 'question',
    body: 'お問い合わせ本文',
    website: '',
};

describe('sendInquiryNotifications', () => {
    beforeEach(() => {
        send.mockReset().mockResolvedValue({ data: { id: 'mail-id' }, error: null });
        process.env['RESEND_API_KEY'] = 're_test';
        process.env['CONTACT_MAIL_FROM'] = 'no-reply@example.com';
        process.env['CONTACT_NOTIFY_TO'] = 'ops@example.com';
    });

    afterEach(() => {
        delete process.env['RESEND_API_KEY'];
        delete process.env['CONTACT_MAIL_FROM'];
        delete process.env['CONTACT_NOTIFY_TO'];
    });

    it('運営宛と送信者宛の 2 通を送信する（種別はラベル・運営通知の replyTo は送信者）', async () => {
        await sendInquiryNotifications(values);

        expect(send).toHaveBeenCalledTimes(2);
        const recipients = send.mock.calls.map((call) => call[0].to);
        expect(recipients).toContain('ops@example.com');
        expect(recipients).toContain('taro@example.com');

        const opsMail = send.mock.calls.find((call) => call[0].to === 'ops@example.com')?.[0];
        expect(opsMail.replyTo).toBe('taro@example.com');
        expect(opsMail.subject).toContain('ご質問');
        // 本文は react-email を HTML / プレーンテキストに別々にレンダリングして渡す
        expect(opsMail.html).toBe('<html>rendered</html>');
        expect(opsMail.text).toBe('plain text');
    });

    it('RESEND_API_KEY 未設定なら送信せず throw する', async () => {
        delete process.env['RESEND_API_KEY'];
        await expect(sendInquiryNotifications(values)).rejects.toThrow('RESEND_API_KEY');
        expect(send).not.toHaveBeenCalled();
    });

    it('CONTACT_NOTIFY_TO 未設定なら throw する', async () => {
        delete process.env['CONTACT_NOTIFY_TO'];
        await expect(sendInquiryNotifications(values)).rejects.toThrow('CONTACT_NOTIFY_TO');
    });

    it('運営通知（1通目）がエラーを返したら throw する（厳密通知）', async () => {
        send.mockResolvedValueOnce({ data: null, error: { message: 'domain not verified' } });
        await expect(sendInquiryNotifications(values)).rejects.toThrow('運営通知メールの送信に失敗');
    });

    it('自動返信（2通目）がエラーを返したら throw する（厳密通知）', async () => {
        send.mockResolvedValueOnce({ data: { id: 'mail-id' }, error: null }).mockResolvedValueOnce({
            data: null,
            error: { message: 'recipient rejected' },
        });
        await expect(sendInquiryNotifications(values)).rejects.toThrow('自動返信メールの送信に失敗');
    });
});
