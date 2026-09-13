import * as yup from 'yup';

import { agreedToTermsField, emailField, emailOptInField, passwordConfirmField, passwordField } from './fields';

/** passwordConfirmField は yup.ref('password') を参照するためオブジェクトスキーマで検証する */
const passwordPairSchema = yup.object({
    password: passwordField,
    passwordConfirm: passwordConfirmField,
});

describe('emailField', () => {
    it('正しいメールアドレスを受け付ける', async () => {
        await expect(emailField.validate('user@example.com')).resolves.toBe('user@example.com');
    });

    it('不正な形式はエラーになる', async () => {
        await expect(emailField.validate('invalid-email')).rejects.toThrow('正しいメールアドレスを入力してください');
    });

    it('未入力はエラーになる', async () => {
        await expect(emailField.validate(undefined)).rejects.toThrow('メールアドレスを入力してください');
    });
});

describe('passwordField', () => {
    it('12文字以上かつ英大小+数字を含めば受け付ける', async () => {
        await expect(passwordField.validate('Abcdef123456')).resolves.toBe('Abcdef123456');
    });

    it('11文字以下はエラーになる', async () => {
        await expect(passwordField.validate('Abcde123456')).rejects.toThrow('パスワードは12文字以上で入力してください');
    });

    it('72文字を超えるとエラーになる', async () => {
        await expect(passwordField.validate(`Aa1${'a'.repeat(70)}`)).rejects.toThrow(
            'パスワードは72文字以内で入力してください',
        );
    });

    it('英大文字を含まないとエラーになる', async () => {
        await expect(passwordField.validate('alllowercase123')).rejects.toThrow(
            'パスワードは英大文字・英小文字・数字をそれぞれ含めてください',
        );
    });

    it('数字を含まないとエラーになる', async () => {
        await expect(passwordField.validate('AbcdefGhijkl')).rejects.toThrow(
            'パスワードは英大文字・英小文字・数字をそれぞれ含めてください',
        );
    });

    it('未入力はエラーになる', async () => {
        await expect(passwordField.validate(undefined)).rejects.toThrow('パスワードを入力してください');
    });

    // 主要パスワードマネージャの自動生成パスワードが通過することを保証する（記号必須にしない方針の回帰）
    it('Google(Chrome) 形式の生成パスワード（英大小数字・記号なし・15文字）を受け付ける', async () => {
        await expect(passwordField.validate('aB3kPq7mNx2RtVz')).resolves.toBe('aB3kPq7mNx2RtVz');
    });

    it('iCloud 形式の生成パスワード（英大小数字・ハイフン・20文字）を受け付ける', async () => {
        await expect(passwordField.validate('hVqx9t-bk2mn4-Rp7wzs')).resolves.toBe('hVqx9t-bk2mn4-Rp7wzs');
    });
});

describe('passwordConfirmField', () => {
    it('password と一致すれば通る', async () => {
        await expect(
            passwordPairSchema.validate({ password: 'Password1234', passwordConfirm: 'Password1234' }),
        ).resolves.toEqual({ password: 'Password1234', passwordConfirm: 'Password1234' });
    });

    it('password と不一致はエラーになる', async () => {
        await expect(
            passwordPairSchema.validate({ password: 'Password1234', passwordConfirm: 'different' }),
        ).rejects.toThrow('パスワードが一致しません');
    });

    it('未入力はエラーになる', async () => {
        await expect(passwordPairSchema.validate({ password: 'Password1234' })).rejects.toThrow(
            '確認用パスワードを入力してください',
        );
    });
});

describe('agreedToTermsField', () => {
    it('true を受け付ける', () => {
        expect(agreedToTermsField.validateSync(true)).toBe(true);
    });

    it('false を拒否する', () => {
        expect(() => agreedToTermsField.validateSync(false)).toThrow('利用規約に同意してください');
    });

    it('未指定（undefined）を拒否する', () => {
        expect(() => agreedToTermsField.validateSync(undefined)).toThrow('利用規約に同意してください');
    });
});

describe('emailOptInField', () => {
    it('true を受け付ける', () => {
        expect(emailOptInField.validateSync(true)).toBe(true);
    });

    it('false を受け付ける（任意のためエラーにしない）', () => {
        expect(emailOptInField.validateSync(false)).toBe(false);
    });

    it('未指定（undefined）はデフォルトの false になる', () => {
        expect(emailOptInField.validateSync(undefined)).toBe(false);
    });
});
