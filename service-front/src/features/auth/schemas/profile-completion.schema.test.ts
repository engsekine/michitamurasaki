import { describe, expect, it } from 'vitest';

import { profileCompletionSchema } from './profile-completion.schema';

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
    agreedToTerms: true,
    diverType: 'general',
};

describe('profileCompletionSchema', () => {
    it('全必須項目が揃っていれば通過し、空の身長・体重は null に正規化される', () => {
        const result = profileCompletionSchema.validateSync(validInput);
        expect(result.nickname).toBe('たろちゃん');
        expect(result.heightCm).toBeNull();
        expect(result.weightKg).toBeNull();
    });

    it('ニックネーム未入力を拒否する', () => {
        expect(() => profileCompletionSchema.validateSync({ ...validInput, nickname: '' })).toThrow();
    });

    it('ローマ字に全角・記号が含まれると拒否する', () => {
        expect(() => profileCompletionSchema.validateSync({ ...validInput, lastNameRomaji: 'やまだ' })).toThrow();
    });

    it('未来日付の生年月日を拒否する', () => {
        expect(() => profileCompletionSchema.validateSync({ ...validInput, birthOn: '2999-01-01' })).toThrow();
    });

    it('性別が 3 値以外だと拒否する', () => {
        expect(() => profileCompletionSchema.validateSync({ ...validInput, gender: 'other' })).toThrow();
    });

    it('利用規約に同意していない（false）と拒否する（018）', () => {
        expect(() => profileCompletionSchema.validateSync({ ...validInput, agreedToTerms: false })).toThrow();
    });

    it('emailOptIn は任意で、未指定ならデフォルト false になる（022）', () => {
        const result = profileCompletionSchema.validateSync(validInput);
        expect(result.emailOptIn).toBe(false);
    });

    it('emailOptIn=true を保持する（022）', () => {
        const result = profileCompletionSchema.validateSync({ ...validInput, emailOptIn: true });
        expect(result.emailOptIn).toBe(true);
    });
});
