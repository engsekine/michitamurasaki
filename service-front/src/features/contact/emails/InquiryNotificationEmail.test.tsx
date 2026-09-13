import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';

import { InquiryNotificationEmail } from './InquiryNotificationEmail';

describe('InquiryNotificationEmail', () => {
    it('氏名・メール・種別ラベル・本文を HTML に描画する', async () => {
        const html = await render(
            InquiryNotificationEmail({
                name: '山田太郎',
                email: 'taro@example.com',
                categoryLabel: 'ご質問',
                body: '質問があります',
            }),
        );

        expect(html).toContain('山田太郎');
        expect(html).toContain('taro@example.com');
        expect(html).toContain('ご質問');
        expect(html).toContain('質問があります');
    });

    it('プレーンテキストにも本文が含まれる', async () => {
        const text = await render(
            InquiryNotificationEmail({
                name: '山田太郎',
                email: 'taro@example.com',
                categoryLabel: 'ご質問',
                body: '質問があります',
            }),
            { plainText: true },
        );

        expect(text).toContain('質問があります');
    });
});
