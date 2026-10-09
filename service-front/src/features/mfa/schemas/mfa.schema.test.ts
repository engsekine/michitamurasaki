import { describe, expect, it } from 'vitest';

import { otpSchema } from './mfa.schema';

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
