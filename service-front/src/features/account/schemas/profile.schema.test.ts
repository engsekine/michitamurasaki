import { describe, expect, it } from 'vitest';

import { profileSchema } from './profile.schema';

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
};

describe('profileSchema - emailOptIn（022）', () => {
    it('emailOptIn 未指定でも通過し、デフォルト false になる（任意）', () => {
        const result = profileSchema.validateSync(validInput);
        expect(result.emailOptIn).toBe(false);
    });

    it('emailOptIn=true を保持する', () => {
        const result = profileSchema.validateSync({ ...validInput, emailOptIn: true });
        expect(result.emailOptIn).toBe(true);
    });
});
