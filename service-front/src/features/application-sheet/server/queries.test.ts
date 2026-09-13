import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApplicationSheetRow } from '../types';
import { getApplicationSheet, getApplicationSheetPrefill, listApplicationSheets } from './queries';

const createClient = vi.fn();

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));

const SHEET_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const sampleSheetRow: ApplicationSheetRow = {
    id: SHEET_UUID,
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

interface SupabaseMockOptions {
    user?: { id: string } | null;
    details?: {
        last_name: string;
        first_name: string;
        birth_on: string;
        gender: string;
        height_cm: number | null;
        weight_kg: number | null;
    } | null;
    certification?: { rank: string } | null;
    divesCount?: number;
    lastDiveDate?: string | null;
    sheetSummaries?: { id: string; name: string; updated_at: string }[];
    sheetRow?: ApplicationSheetRow | null;
    baseProfile?: Record<string, unknown> | null;
}

const buildSupabaseMock = (options: SupabaseMockOptions = {}) => {
    const {
        user = { id: 'user-1' },
        details = null,
        certification = null,
        divesCount = 0,
        lastDiveDate = null,
        sheetSummaries = [],
        sheetRow = null,
        baseProfile = null,
    } = options;

    const divesEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
                data: lastDiveDate ? [{ dive_date: lastDiveDate }] : [],
                count: divesCount,
                error: null,
            }),
        }),
    });

    // 一覧: select().eq('kind','sheet').order() / 1 件: select().eq('id').eq('kind').maybeSingle()
    // 基本情報: select().eq('kind','base').maybeSingle()
    const sheetsOrder = vi.fn().mockResolvedValue({ data: sheetSummaries, error: null });
    const sheetsGetMaybeSingle = vi.fn().mockResolvedValue({ data: sheetRow, error: null });
    const baseMaybeSingle = vi.fn().mockResolvedValue({ data: baseProfile, error: null });
    const sheetsEq = vi.fn((column: string, value: string) => {
        if (column === 'kind' && value === 'base') return { maybeSingle: baseMaybeSingle };
        if (column === 'kind' && value === 'sheet') return { order: sheetsOrder };
        // eq('id', ...) → eq('kind', 'sheet') → maybeSingle()
        return { eq: vi.fn().mockReturnValue({ maybeSingle: sheetsGetMaybeSingle }) };
    });
    const sheetsSelect = vi.fn().mockReturnValue({ eq: sheetsEq });

    const from = vi.fn((table: string) => {
        if (table === 'user_details') {
            return {
                select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: details, error: null }),
                }),
            };
        }
        if (table === 'certifications') {
            return {
                select: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({ data: certification, error: null }),
                            }),
                        }),
                    }),
                }),
            };
        }
        if (table === 'dives') {
            return { select: vi.fn().mockReturnValue({ eq: divesEq }) };
        }
        if (table === 'application_sheets') {
            return { select: sheetsSelect };
        }
        throw new Error(`unexpected table: ${table}`);
    });

    const supabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
        from,
    };
    createClient.mockResolvedValue(supabase);
    const sheetsEqCalls = () => sheetsEq.mock.calls;
    return { from, divesEq, sheetsSelect, sheetsOrder, sheetsEq, sheetsEqCalls };
};

describe('getApplicationSheetPrefill', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 年齢算出（JST 基準）を安定させるため現在時刻を固定する
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-10T12:00:00+09:00'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('登録済みデータを各項目にマッピングする（FR-007）', async () => {
        buildSupabaseMock({
            details: {
                last_name: '山田',
                first_name: '太郎',
                birth_on: '1990-05-03',
                gender: 'male',
                height_cm: 172.5,
                weight_kg: 65,
            },
            certification: { rank: 'Advanced Open Water Diver' },
            divesCount: 52,
            lastDiveDate: '2026-05-10',
        });

        const prefill = await getApplicationSheetPrefill();

        expect(prefill.fullName).toBe('山田 太郎');
        expect(prefill.birthOn).toBe('1990-05-03');
        expect(prefill.age).toBe(36);
        expect(prefill.gender).toBe('male');
        expect(prefill.heightCm).toBe(172.5);
        expect(prefill.weightKg).toBe(65);
        expect(prefill.licenseRank).toBe('Advanced Open Water Diver');
        expect(prefill.diveCount).toBe(52);
        expect(prefill.lastDiveYearMonth).toBe('2026-05');
    });

    it('誕生日前は満年齢が 1 歳下がる', async () => {
        buildSupabaseMock({
            details: {
                last_name: '山田',
                first_name: '太郎',
                birth_on: '1990-08-01',
                gender: 'male',
                height_cm: null,
                weight_kg: null,
            },
        });

        const prefill = await getApplicationSheetPrefill();

        expect(prefill.age).toBe(35);
    });

    it('gender が unanswered の場合は null（空欄扱い）になる', async () => {
        buildSupabaseMock({
            details: {
                last_name: '山田',
                first_name: '花子',
                birth_on: '1995-01-01',
                gender: 'unanswered',
                height_cm: null,
                weight_kg: null,
            },
        });

        const prefill = await getApplicationSheetPrefill();

        expect(prefill.gender).toBeNull();
        expect(prefill.heightCm).toBeNull();
        expect(prefill.weightKg).toBeNull();
    });

    it('各ソースが未登録なら null を返しエラーにならない（FR-009）', async () => {
        buildSupabaseMock({ details: null, certification: null, divesCount: 0, lastDiveDate: null });

        const prefill = await getApplicationSheetPrefill();

        expect(prefill).toEqual({
            fullName: null,
            birthOn: null,
            age: null,
            gender: null,
            heightCm: null,
            weightKg: null,
            licenseRank: null,
            diveCount: null,
            lastDiveYearMonth: null,
            phone: null,
            emergencyContactRelation: null,
            emergencyContactPhone: null,
            nearestStation: null,
            hasDrySuitExperience: null,
            drySuitDiveCount: null,
        });
    });

    it('保存済みの基本情報はプロフィール由来の値より優先され、空欄はプロフィールで補完される', async () => {
        buildSupabaseMock({
            details: {
                last_name: '山田',
                first_name: '太郎',
                birth_on: '1990-05-03',
                gender: 'male',
                height_cm: 172.5,
                weight_kg: 65,
            },
            certification: { rank: 'Open Water Diver' },
            divesCount: 8,
            lastDiveDate: '2025-10-01',
            baseProfile: {
                full_name: '山田 太郎（改名後）',
                age: null,
                birth_on: null,
                gender: null,
                phone: '090-1234-5678',
                emergency_contact_relation: '妻',
                emergency_contact_phone: '080-9876-5432',
                nearest_station: '横浜駅',
                license_rank: 'Rescue Diver',
                dive_count: 120,
                last_dive_year_month: '2026-06',
                has_dry_suit_experience: true,
                dry_suit_dive_count: 15,
            },
        });

        const prefill = await getApplicationSheetPrefill();

        // 保存値が優先される
        expect(prefill.fullName).toBe('山田 太郎（改名後）');
        expect(prefill.phone).toBe('090-1234-5678');
        expect(prefill.emergencyContactRelation).toBe('妻');
        expect(prefill.emergencyContactPhone).toBe('080-9876-5432');
        expect(prefill.nearestStation).toBe('横浜駅');
        // 経験も保存値が優先される（資格・ログ由来の値より優先）
        expect(prefill.licenseRank).toBe('Rescue Diver');
        expect(prefill.diveCount).toBe(120);
        expect(prefill.lastDiveYearMonth).toBe('2026-06');
        expect(prefill.hasDrySuitExperience).toBe(true);
        expect(prefill.drySuitDiveCount).toBe(15);
        // 保存値が空の項目はプロフィールで補完される
        expect(prefill.birthOn).toBe('1990-05-03');
        expect(prefill.age).toBe(36);
        expect(prefill.gender).toBe('male');
    });

    it('公開読み取り RLS で他人のログを数えないよう dives は本人 user_id で絞る', async () => {
        const { divesEq } = buildSupabaseMock({ divesCount: 3, lastDiveDate: '2025-12-31' });

        const prefill = await getApplicationSheetPrefill();

        expect(divesEq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(prefill.diveCount).toBe(3);
        expect(prefill.lastDiveYearMonth).toBe('2025-12');
    });
});

describe('listApplicationSheets', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('保存済みシートのサマリーを返す（camelCase）', async () => {
        const { sheetsOrder, sheetsEqCalls } = buildSupabaseMock({
            sheetSummaries: [
                { id: 'sheet-2', name: 'B ショップ用', updated_at: '2026-07-11T02:00:00Z' },
                { id: 'sheet-1', name: 'A ショップ用', updated_at: '2026-07-10T00:00:00Z' },
            ],
        });

        const sheets = await listApplicationSheets();

        expect(sheets).toEqual([
            { id: 'sheet-2', name: 'B ショップ用', updatedAt: '2026-07-11T02:00:00Z' },
            { id: 'sheet-1', name: 'A ショップ用', updatedAt: '2026-07-10T00:00:00Z' },
        ]);
        // 一覧は kind='sheet' のみ・更新日時の降順（基本情報の行は出さない）
        expect(sheetsEqCalls()).toContainEqual(['kind', 'sheet']);
        expect(sheetsOrder).toHaveBeenCalledWith('updated_at', { ascending: false });
    });

    it('保存が無ければ空配列を返す', async () => {
        buildSupabaseMock({ sheetSummaries: [] });

        expect(await listApplicationSheets()).toEqual([]);
    });
});

describe('getApplicationSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('シートをフォーム値のスナップショットとして返す', async () => {
        const { sheetsEq } = buildSupabaseMock({ sheetRow: sampleSheetRow });

        const sheet = await getApplicationSheet(SHEET_UUID);

        expect(sheetsEq).toHaveBeenCalledWith('id', SHEET_UUID);
        expect(sheet?.id).toBe(SHEET_UUID);
        expect(sheet?.name).toBe('〇〇ショップ用');
        expect(sheet?.values.fullName).toBe('山田 太郎');
        expect(sheet?.values.rentalItems).toEqual(['wetSuitFullSet', 'fin']);
        expect(sheet?.values.hasRental).toBe('yes');
    });

    it('見つからない（他人のシート含む・RLS）場合は null を返す', async () => {
        buildSupabaseMock({ sheetRow: null });

        expect(await getApplicationSheet('00000000-0000-4000-8000-000000000000')).toBeNull();
    });

    it('UUID 形式でない ID は DB を参照せず null を返す（URL 直打ち対策）', async () => {
        const { from } = buildSupabaseMock();

        expect(await getApplicationSheet('not-a-uuid')).toBeNull();
        expect(from).not.toHaveBeenCalledWith('application_sheets');
    });
});
