import { describe, expect, it } from 'vitest';

import type { ApplicationSheetRow } from '../../types';
import { sheetToFormValues } from './sheetToFormValues';

const baseRow: ApplicationSheetRow = {
    id: 'sheet-1',
    user_id: 'user-1',
    kind: 'sheet',
    name: '〇〇ショップ用',
    full_name: '山田 太郎',
    age: 36,
    birth_on: '1990-05-03',
    gender: 'male',
    phone: '090-1234-5678',
    emergency_contact_relation: '妻',
    emergency_contact_phone: '080-9876-5432',
    nearest_station: '横浜駅',
    license_rank: 'Open Water Diver',
    dive_count: 52,
    last_dive_year_month: '2026-05',
    has_dry_suit_experience: null,
    dry_suit_dive_count: 10,
    has_rental: true,
    rental_items: ['wetSuitFullSet', 'fin'],
    omit_rental_block: false,
    height_cm: 172.5,
    weight_kg: 65,
    foot_size_cm: 26.5,
    has_contact_lens: true,
    contact_lens_type: 'soft',
    needs_prescription_mask: false,
    created_at: '2026-07-11T00:00:00Z',
    dive_shop_id: null,
    updated_at: '2026-07-11T00:00:00Z',
};

describe('sheetToFormValues', () => {
    it('保存済みシートの行をフォーム値へ変換する（数値は文字列・boolean は yes/no）', () => {
        expect(sheetToFormValues(baseRow)).toEqual({
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
            hasDrySuitExperience: '',
            drySuitDiveCount: '10',
            hasRental: 'yes',
            rentalItems: ['wetSuitFullSet', 'fin'],
            omitRentalBlock: false,
            heightCm: '172.5',
            weightKg: '65',
            footSizeCm: '26.5',
            hasContactLens: 'yes',
            contactLensType: 'soft',
            needsPrescriptionMask: 'no',
            diveShopId: '',
        });
    });

    it('null / 空の項目はフォームの空値（空文字・未選択）になる', () => {
        const values = sheetToFormValues({
            ...baseRow,
            full_name: '',
            age: null,
            birth_on: null,
            gender: null,
            dive_count: null,
            last_dive_year_month: null,
            dry_suit_dive_count: null,
            has_rental: null,
            rental_items: [],
            height_cm: null,
            weight_kg: null,
            foot_size_cm: null,
            has_contact_lens: null,
            contact_lens_type: null,
            needs_prescription_mask: null,
        });

        expect(values.fullName).toBe('');
        expect(values.age).toBe('');
        expect(values.birthOn).toBe('');
        expect(values.gender).toBe('');
        expect(values.diveCount).toBe('');
        expect(values.lastDiveYearMonth).toBe('');
        expect(values.hasRental).toBe('');
        expect(values.rentalItems).toEqual([]);
        expect(values.heightCm).toBe('');
        expect(values.contactLensType).toBe('');
        expect(values.needsPrescriptionMask).toBe('');
    });

    it('rental_items に未知のキーが混ざっていても既知のキーだけ復元する', () => {
        const values = sheetToFormValues({
            ...baseRow,
            rental_items: ['fin', 'unknownItem', 123, null],
        });

        expect(values.rentalItems).toEqual(['fin']);
    });
});
