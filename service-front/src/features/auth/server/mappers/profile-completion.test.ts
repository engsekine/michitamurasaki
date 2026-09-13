import { describe, expect, it } from 'vitest';

import { CURRENT_TERMS_VERSION } from '@/shared/constants/terms';

import type { CompleteProfileInput } from '../actions';
import { toUserDetailsInsert } from './profile-completion';

const input: CompleteProfileInput = {
    lastName: '山田',
    firstName: '太郎',
    lastNameRomaji: 'Yamada',
    firstNameRomaji: 'Taro',
    nickname: 'たろちゃん',
    handle: 'taro-diver',
    birthOn: '1990-01-01',
    gender: 'male',
    heightCm: 170.5,
    weightKg: 65,
    agreedToTerms: true,
    diverType: 'instructor',
    diverNumber: 'PADI-12345',
    emailOptIn: false,
};

describe('toUserDetailsInsert', () => {
    it('user_id を付与し camelCase を snake_case の INSERT ペイロードに変換する', () => {
        expect(toUserDetailsInsert('user-1', input)).toEqual(
            expect.objectContaining({
                user_id: 'user-1',
                last_name: '山田',
                first_name: '太郎',
                last_name_romaji: 'Yamada',
                first_name_romaji: 'Taro',
                nickname: 'たろちゃん',
                handle: 'taro-diver',
                birth_on: '1990-01-01',
                gender: 'male',
                height_cm: 170.5,
                weight_kg: 65,
            }),
        );
    });

    it('利用規約の同意情報（terms_version / terms_agreed_at）を両方セットする（018）', () => {
        const result = toUserDetailsInsert('user-1', input);
        expect(result.terms_version).toBe(CURRENT_TERMS_VERSION);
        expect(typeof result.terms_agreed_at).toBe('string');
    });

    it('ダイバー種別を保存し、インストラクターのときは番号も保存する（019）', () => {
        const result = toUserDetailsInsert('user-1', input);
        expect(result.diver_type).toBe('instructor');
        expect(result.diver_number).toBe('PADI-12345');
    });

    it('一般ダイバーのときは番号を null にする（019 / CHECK 整合）', () => {
        const result = toUserDetailsInsert('user-1', { ...input, diverType: 'general', diverNumber: 'X999' });
        expect(result.diver_type).toBe('general');
        expect(result.diver_number).toBeNull();
    });

    it('身長・体重が null の場合もそのまま null を保持する', () => {
        const result = toUserDetailsInsert('user-1', { ...input, heightCm: null, weightKg: null });
        expect(result.height_cm).toBeNull();
        expect(result.weight_kg).toBeNull();
    });

    it('emailOptIn=true なら is_email_opted_in=true と email_opted_in_at（非 null）をセットする（022）', () => {
        const result = toUserDetailsInsert('user-1', { ...input, emailOptIn: true });
        expect(result.is_email_opted_in).toBe(true);
        expect(typeof result.email_opted_in_at).toBe('string');
    });

    it('emailOptIn=false なら is_email_opted_in=false と email_opted_in_at=null をセットする（022）', () => {
        const result = toUserDetailsInsert('user-1', { ...input, emailOptIn: false });
        expect(result.is_email_opted_in).toBe(false);
        expect(result.email_opted_in_at).toBeNull();
    });
});
