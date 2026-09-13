import { describe, expect, it } from 'vitest';

import { otpSchema, phoneSchema } from './mfa.schema';

describe('phoneSchema', () => {
    it('E.164 形式の番号を受け入れる', async () => {
        await expect(phoneSchema.validate({ phone: '+819012345678' })).resolves.toBeTruthy();
    });

    it('空・国内形式・記号入りは拒否する', async () => {
        await expect(phoneSchema.validate({ phone: '' })).rejects.toThrow('電話番号を入力してください');
        await expect(phoneSchema.validate({ phone: '09012345678' })).rejects.toThrow('国際形式');
        await expect(phoneSchema.validate({ phone: '+81-90-1234-5678' })).rejects.toThrow('国際形式');
    });
});

describe('otpSchema', () => {
    it('6 桁の数字を受け入れる', async () => {
        await expect(otpSchema.validate({ code: '123456' })).resolves.toBeTruthy();
    });

    it('空・桁不足・数字以外は拒否する', async () => {
        await expect(otpSchema.validate({ code: '' })).rejects.toThrow('確認コードを入力してください');
        await expect(otpSchema.validate({ code: '123' })).rejects.toThrow('6 桁の数字');
        await expect(otpSchema.validate({ code: 'abcdef' })).rejects.toThrow('6 桁の数字');
    });
});
