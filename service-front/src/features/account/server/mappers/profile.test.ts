import { type ProfileRow, resolveEmailOptedInAt, toProfile, toUserDetailsUpdate } from './profile';

const baseRow: ProfileRow = {
    last_name: '田中',
    first_name: '太郎',
    last_name_romaji: 'Tanaka',
    first_name_romaji: 'Taro',
    nickname: 'タロー',
    handle: 'taro-diver',
    birth_on: '1990-01-01',
    gender: 'male',
    height_cm: 170.5,
    weight_kg: 65.2,
    diver_type: 'instructor',
    diver_number: 'PADI-1',
    is_email_opted_in: false,
};

describe('toProfile', () => {
    it('snake_case の Row を camelCase のドメイン型に変換する', () => {
        expect(toProfile(baseRow, 'test@example.com')).toEqual({
            email: 'test@example.com',
            lastName: '田中',
            firstName: '太郎',
            lastNameRomaji: 'Tanaka',
            firstNameRomaji: 'Taro',
            nickname: 'タロー',
            handle: 'taro-diver',
            birthOn: '1990-01-01',
            gender: 'male',
            heightCm: 170.5,
            weightKg: 65.2,
            diverType: 'instructor',
            diverNumber: 'PADI-1',
            emailOptIn: false,
        });
    });

    it('is_email_opted_in を emailOptIn にマップする（022）', () => {
        const result = toProfile({ ...baseRow, is_email_opted_in: true }, 'test@example.com');
        expect(result.emailOptIn).toBe(true);
    });

    it('height_cm / weight_kg が null ならそのまま null を保持する', () => {
        const row: ProfileRow = { ...baseRow, height_cm: null, weight_kg: null };
        const result = toProfile(row, 'test@example.com');

        expect(result.heightCm).toBeNull();
        expect(result.weightKg).toBeNull();
    });

    it('height_cm / weight_kg が数値ならそのまま数値で返す', () => {
        const row: ProfileRow = { ...baseRow, height_cm: 180, weight_kg: 70 };
        const result = toProfile(row, 'test@example.com');

        expect(result.heightCm).toBe(180);
        expect(result.weightKg).toBe(70);
    });
});

const baseUpdateInput = {
    lastName: '佐藤',
    firstName: '花子',
    lastNameRomaji: 'Sato',
    firstNameRomaji: 'Hanako',
    nickname: 'はな',
    handle: 'taro-diver',
    birthOn: '1995-05-05',
    gender: 'female' as const,
    heightCm: 160,
    weightKg: 50,
    diverType: 'general' as const,
    diverNumber: null,
    emailOptIn: true,
};

describe('toUserDetailsUpdate', () => {
    it('camelCase の入力を snake_case の DB ペイロードに変換する（diver / opt-in 列含む）', () => {
        expect(toUserDetailsUpdate(baseUpdateInput, '2026-06-29T00:00:00.000Z')).toEqual({
            last_name: '佐藤',
            first_name: '花子',
            last_name_romaji: 'Sato',
            first_name_romaji: 'Hanako',
            nickname: 'はな',
            handle: 'taro-diver',
            birth_on: '1995-05-05',
            gender: 'female',
            height_cm: 160,
            weight_kg: 50,
            diver_type: 'general',
            diver_number: null,
            is_email_opted_in: true,
            email_opted_in_at: '2026-06-29T00:00:00.000Z',
        });
    });

    it('heightCm / weightKg が null ならそのまま null を渡す', () => {
        const result = toUserDetailsUpdate(
            { ...baseUpdateInput, gender: 'unanswered', heightCm: null, weightKg: null, emailOptIn: false },
            null,
        );

        expect(result.height_cm).toBeNull();
        expect(result.weight_kg).toBeNull();
    });

    it('一般ダイバーに変更時はダイバー番号を null にする（019 / FR-009）', () => {
        const result = toUserDetailsUpdate(
            { ...baseUpdateInput, diverType: 'general', diverNumber: 'OLD-123', emailOptIn: false },
            null,
        );

        expect(result.diver_type).toBe('general');
        expect(result.diver_number).toBeNull();
    });

    it('不許可なら email_opted_in_at に null を渡す（022）', () => {
        const result = toUserDetailsUpdate({ ...baseUpdateInput, emailOptIn: false }, null);
        expect(result.is_email_opted_in).toBe(false);
        expect(result.email_opted_in_at).toBeNull();
    });
});

describe('resolveEmailOptedInAt（022）', () => {
    const now = '2026-06-29T12:00:00.000Z';
    const past = '2026-01-01T00:00:00.000Z';

    it('不許可（false）なら常に null', () => {
        expect(resolveEmailOptedInAt(false, true, past, now)).toBeNull();
        expect(resolveEmailOptedInAt(false, false, null, now)).toBeNull();
    });

    it('OFF→ON は now を採用する', () => {
        expect(resolveEmailOptedInAt(true, false, null, now)).toBe(now);
    });

    it('ON 維持（既存日時あり）は既存日時を保持する', () => {
        expect(resolveEmailOptedInAt(true, true, past, now)).toBe(past);
    });

    it('ON だが既存日時が無い場合は now を採用する（整合修復）', () => {
        expect(resolveEmailOptedInAt(true, true, null, now)).toBe(now);
    });
});
