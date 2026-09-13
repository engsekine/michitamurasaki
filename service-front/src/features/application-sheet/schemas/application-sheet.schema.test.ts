import { describe, expect, it } from 'vitest';

import { applicationSheetSchema } from './application-sheet.schema';

/** 全項目未入力（フォーム初期状態） */
const emptyInput = {
    fullName: '',
    age: '',
    birthOn: '',
    gender: '',
    phone: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    nearestStation: '',
    licenseRank: '',
    diveCount: '',
    lastDiveYearMonth: '',
    hasDrySuitExperience: '',
    drySuitDiveCount: '',
    hasRental: '',
    rentalItems: [],
    omitRentalBlock: false,
    heightCm: '',
    weightKg: '',
    footSizeCm: '',
    hasContactLens: '',
    contactLensType: '',
    needsPrescriptionMask: '',
};

const filledInput = {
    ...emptyInput,
    fullName: '山田 太郎',
    age: '36',
    birthOn: '1990-05-03',
    gender: 'male',
    phone: '090-1234-5678',
    emergencyContactRelation: '妻',
    emergencyContactPhone: '080-9876-5432',
    nearestStation: '横浜駅',
    licenseRank: 'Open Water Diver',
    diveCount: '52',
    lastDiveYearMonth: '2026年5月',
    hasDrySuitExperience: 'no',
    drySuitDiveCount: '',
    hasRental: 'yes',
    rentalItems: ['wetSuitFullSet', 'fin'],
    heightCm: '172.5',
    weightKg: '65',
    footSizeCm: '26.5',
    hasContactLens: 'yes',
    contactLensType: 'soft',
    needsPrescriptionMask: 'no',
};

describe('applicationSheetSchema', () => {
    it('スキーマのデフォルトはレンタル「無」+ 省略トグル ON（FR-012）', () => {
        const defaults = applicationSheetSchema.getDefault();
        expect(defaults.hasRental).toBe('no');
        expect(defaults.omitRentalBlock).toBe(true);
    });

    it('全項目未入力でも通る（全項目任意・FR-005）', async () => {
        const result = await applicationSheetSchema.validate(emptyInput);
        expect(result.fullName).toBe('');
        expect(result.rentalItems).toEqual([]);
        expect(result.omitRentalBlock).toBe(false);
    });

    it('全項目入力済みの値をパースできる', async () => {
        const result = await applicationSheetSchema.validate(filledInput);
        expect(result.fullName).toBe('山田 太郎');
        expect(result.phone).toBe('090-1234-5678');
        expect(result.rentalItems).toEqual(['wetSuitFullSet', 'fin']);
        expect(result.footSizeCm).toBe('26.5');
    });

    it('氏名の前後の空白は trim される', async () => {
        const result = await applicationSheetSchema.validate({ ...emptyInput, fullName: '  山田 太郎  ' });
        expect(result.fullName).toBe('山田 太郎');
    });

    describe('電話番号', () => {
        it('数字とハイフンの形式を受け付ける', async () => {
            const result = await applicationSheetSchema.validate({ ...emptyInput, phone: '09012345678' });
            expect(result.phone).toBe('09012345678');
        });

        it('数字とハイフン以外が含まれるとエラーになる', async () => {
            await expect(applicationSheetSchema.validate({ ...emptyInput, phone: '090-abcd' })).rejects.toThrow(
                '携帯電話は数字とハイフンで入力してください',
            );
        });

        it('20 文字を超えるとエラーになる', async () => {
            await expect(applicationSheetSchema.validate({ ...emptyInput, phone: '1'.repeat(21) })).rejects.toThrow(
                '携帯電話は20文字以内で入力してください',
            );
        });

        it('緊急連絡先の電話番号も形式チェックされる', async () => {
            await expect(
                applicationSheetSchema.validate({ ...emptyInput, emergencyContactPhone: 'テスト' }),
            ).rejects.toThrow('緊急連絡先の電話番号は数字とハイフンで入力してください');
        });
    });

    describe('足のサイズ', () => {
        it('小数第 1 位までの数値を受け付ける', async () => {
            const result = await applicationSheetSchema.validate({ ...emptyInput, footSizeCm: '26.5' });
            expect(result.footSizeCm).toBe('26.5');
        });

        it('数値以外はエラーになる', async () => {
            await expect(applicationSheetSchema.validate({ ...emptyInput, footSizeCm: '26cm' })).rejects.toThrow(
                '足のサイズは数字で入力してください',
            );
        });

        it('50 を超えるとエラーになる', async () => {
            await expect(applicationSheetSchema.validate({ ...emptyInput, footSizeCm: '50.5' })).rejects.toThrow(
                '足のサイズは50cm以下で入力してください',
            );
        });

        it('0 はエラーになる', async () => {
            await expect(applicationSheetSchema.validate({ ...emptyInput, footSizeCm: '0' })).rejects.toThrow(
                '足のサイズは0より大きい値を入力してください',
            );
        });
    });

    describe('本数・年齢', () => {
        it('経験本数は数字のみ受け付ける', async () => {
            await expect(applicationSheetSchema.validate({ ...emptyInput, diveCount: '約50' })).rejects.toThrow(
                '経験本数は数字で入力してください',
            );
        });

        it('ドライスーツ経験本数は数字のみ受け付ける', async () => {
            await expect(applicationSheetSchema.validate({ ...emptyInput, drySuitDiveCount: '-1' })).rejects.toThrow(
                'ドライスーツの経験本数は数字で入力してください',
            );
        });

        it('年齢は 3 桁までの数字を受け付ける', async () => {
            const result = await applicationSheetSchema.validate({ ...emptyInput, age: '36' });
            expect(result.age).toBe('36');
            await expect(applicationSheetSchema.validate({ ...emptyInput, age: '1000' })).rejects.toThrow(
                '年齢は数字で入力してください',
            );
        });
    });

    describe('日付形式', () => {
        it('生年月日は YYYY-MM-DD 形式のみ受け付ける', async () => {
            await expect(applicationSheetSchema.validate({ ...emptyInput, birthOn: '1990/05/03' })).rejects.toThrow(
                '生年月日を正しく入力してください',
            );
        });

        it('最終ダイブ年月は「YYYY年M月」形式のみ受け付ける', async () => {
            await expect(
                applicationSheetSchema.validate({ ...emptyInput, lastDiveYearMonth: '2026-05' }),
            ).rejects.toThrow('最終ダイブ年月は「2026年7月」の形式で入力してください');
            await expect(
                applicationSheetSchema.validate({ ...emptyInput, lastDiveYearMonth: '2026年13月' }),
            ).rejects.toThrow('最終ダイブ年月は「2026年7月」の形式で入力してください');
            const result = await applicationSheetSchema.validate({ ...emptyInput, lastDiveYearMonth: '2026年7月' });
            expect(result.lastDiveYearMonth).toBe('2026年7月');
        });
    });

    describe('選択値', () => {
        it('有無系は yes / no / 空のみ受け付ける', async () => {
            await expect(applicationSheetSchema.validate({ ...emptyInput, hasRental: 'maybe' })).rejects.toThrow();
        });

        it('レンタル品目は定義済みキーのみ受け付ける', async () => {
            await expect(
                applicationSheetSchema.validate({ ...emptyInput, rentalItems: ['unknownItem'] }),
            ).rejects.toThrow();
        });

        it('コンタクト「無」でも種類の指定はエラーにしない（出力側で無視される）', async () => {
            const result = await applicationSheetSchema.validate({
                ...emptyInput,
                hasContactLens: 'no',
                contactLensType: 'soft',
            });
            expect(result.hasContactLens).toBe('no');
            expect(result.contactLensType).toBe('soft');
        });
    });
});
