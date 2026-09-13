import { describe, expect, it } from 'vitest';

import { signupSchema } from './signup.schema';

const validInput = {
    lastName: '山田',
    firstName: '太郎',
    lastNameRomaji: 'Yamada',
    firstNameRomaji: 'Taro',
    nickname: 'たろちゃん',
    handle: 'taro-diver',
    birthOn: '1990-01-01',
    gender: 'male',
    heightCm: '',
    weightKg: '',
    email: 'user@example.com',
    password: 'Password1234',
    passwordConfirm: 'Password1234',
    agreedToTerms: true,
    diverType: 'general',
};

describe('signupSchema - agreedToTerms（018）', () => {
    it('利用規約に同意（true）していれば通過する', () => {
        expect(() => signupSchema.validateSync(validInput)).not.toThrow();
    });

    it('利用規約に同意していない（false）と拒否する', () => {
        expect(() => signupSchema.validateSync({ ...validInput, agreedToTerms: false })).toThrow(
            '利用規約に同意してください',
        );
    });

    it('agreedToTerms が未指定だと拒否する', () => {
        const { agreedToTerms, ...withoutAgree } = validInput;
        void agreedToTerms;
        expect(() => signupSchema.validateSync(withoutAgree)).toThrow();
    });
});

describe('signupSchema - emailOptIn（022）', () => {
    it('emailOptIn=true で通過し true を保持する', () => {
        const result = signupSchema.validateSync({ ...validInput, emailOptIn: true });
        expect(result.emailOptIn).toBe(true);
    });

    it('emailOptIn 未指定でも通過し、デフォルト false になる（任意）', () => {
        const result = signupSchema.validateSync(validInput);
        expect(result.emailOptIn).toBe(false);
    });
});
