import type { Dive } from '@/features/dives/types';

import { mapDiveToFormValues } from './mappers';

const buildDive = (overrides: Partial<Dive> = {}): Dive => ({
    id: 'dive-1',
    userId: 'user-1',
    diveNumber: 42,
    diveDate: '2026-04-15',
    entryTime: '09:30:00',
    exitTime: '10:15:00',
    location: '伊豆 / 大瀬崎',
    diveSiteId: null,
    diveSite: null,
    diveShopId: null,
    shop: null,
    diveType: 'boat',
    weather: '晴れ',
    airTempC: 24,
    waterTempC: 20.5,
    visibilityM: 15,
    wave: '穏やか',
    currentCondition: 'なし',
    maxDepthM: 18.5,
    avgDepthM: 12,
    bottomTimeMin: 45,
    tankType: 'steel',
    tankVolumeL: 10,
    gasType: 'air',
    o2Percent: 21,
    pressureStartBar: 200,
    pressureEndBar: 50,
    weightKg: 4,
    suitType: 'ウェット 5mm',
    equipmentNotes: 'フード着用',
    buddyName: '山田',
    instructorName: null,
    certificationDive: false,
    notes: 'ウミガメに遭遇',
    isPublic: false,
    publicSlug: null,
    createdAt: '2026-04-15T12:00:00Z',
    updatedAt: '2026-04-15T12:00:00Z',
    ...overrides,
});

describe('mapDiveToFormValues', () => {
    it('フォームで扱う全フィールドをそのまま引き継ぐ', () => {
        const result = mapDiveToFormValues(buildDive());

        expect(result).toEqual({
            diveNumber: 42,
            diveDate: '2026-04-15',
            entryTime: '09:30:00',
            exitTime: '10:15:00',
            location: '伊豆 / 大瀬崎',
            diveSiteId: null,
            diveType: 'boat',
            weather: '晴れ',
            airTempC: 24,
            waterTempC: 20.5,
            visibilityM: 15,
            wave: '穏やか',
            currentCondition: 'なし',
            maxDepthM: 18.5,
            avgDepthM: 12,
            bottomTimeMin: 45,
            tankType: 'steel',
            tankVolumeL: 10,
            gasType: 'air',
            o2Percent: 21,
            pressureStartBar: 200,
            pressureEndBar: 50,
            weightKg: 4,
            suitType: 'ウェット 5mm',
            equipmentNotes: 'フード着用',
            buddyName: '山田',
            instructorName: null,
            certificationDive: false,
            notes: 'ウミガメに遭遇',
        });
    });

    it('フォームで扱わないメタ情報（id / userId / 公開設定 / タイムスタンプ）を含めない', () => {
        const result = mapDiveToFormValues(buildDive());

        expect(result).not.toHaveProperty('id');
        expect(result).not.toHaveProperty('userId');
        expect(result).not.toHaveProperty('isPublic');
        expect(result).not.toHaveProperty('publicSlug');
        expect(result).not.toHaveProperty('createdAt');
        expect(result).not.toHaveProperty('updatedAt');
    });

    it('null の任意項目は null のまま引き継ぐ', () => {
        const result = mapDiveToFormValues(buildDive({ diveNumber: null, entryTime: null, avgDepthM: null }));

        expect(result.diveNumber).toBeNull();
        expect(result.entryTime).toBeNull();
        expect(result.avgDepthM).toBeNull();
    });
});
