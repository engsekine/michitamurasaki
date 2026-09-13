import { describe, expect, it } from 'vitest';

import { contactSchema } from './contact.schema';

const valid = {
    name: '山田太郎',
    email: 'taro@example.com',
    category: 'question',
    body: '質問があります',
    website: '',
};

describe('contactSchema', () => {
    it('正しい入力を受理する', async () => {
        await expect(contactSchema.validate(valid)).resolves.toMatchObject(valid);
    });

    it('必須項目が空だと拒否する', async () => {
        await expect(contactSchema.validate({ ...valid, name: '' })).rejects.toThrow('お名前を入力してください');
        await expect(contactSchema.validate({ ...valid, email: '' })).rejects.toThrow(
            'メールアドレスを入力してください',
        );
        await expect(contactSchema.validate({ ...valid, body: '' })).rejects.toThrow(
            'お問い合わせ内容を入力してください',
        );
        await expect(contactSchema.validate({ ...valid, category: '' })).rejects.toThrow(
            'お問い合わせ種別を選択してください',
        );
    });

    it('メールアドレスの形式不正を拒否する', async () => {
        await expect(contactSchema.validate({ ...valid, email: 'not-an-email' })).rejects.toThrow(
            'メールアドレスの形式が正しくありません',
        );
    });

    it('許可外の種別を拒否する', async () => {
        await expect(contactSchema.validate({ ...valid, category: 'spam' })).rejects.toThrow(
            'お問い合わせ種別を選択してください',
        );
    });

    it('本文が 1,000 文字を超えると拒否する', async () => {
        await expect(contactSchema.validate({ ...valid, body: 'あ'.repeat(1001) })).rejects.toThrow(
            'お問い合わせ内容は 1000 文字以内で入力してください',
        );
    });

    it('本文が 1,000 文字ちょうどは受理する', async () => {
        await expect(contactSchema.validate({ ...valid, body: 'あ'.repeat(1000) })).resolves.toBeTruthy();
    });
});
