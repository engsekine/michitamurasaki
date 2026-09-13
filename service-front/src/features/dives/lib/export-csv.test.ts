import type { Dive } from '@/features/dives/types';

import { divesToCsv } from './export-csv';

const buildDive = (overrides: Partial<Dive> = {}): Dive => ({
    id: 'd1',
    userId: 'u1',
    diveNumber: 12,
    diveDate: '2025-07-01',
    entryTime: '10:00:00',
    diveShopId: null,
    shop: null,
    exitTime: '10:45:00',
    location: '大瀬崎',
    diveSiteId: null,
    diveSite: null,
    diveType: 'boat',
    weather: '晴れ',
    airTempC: 28,
    waterTempC: 24.5,
    visibilityM: 15,
    wave: null,
    currentCondition: null,
    maxDepthM: 18.5,
    avgDepthM: 12,
    bottomTimeMin: 45,
    tankType: 'aluminum',
    tankVolumeL: 10,
    gasType: 'air',
    o2Percent: null,
    pressureStartBar: 200,
    pressureEndBar: 50,
    weightKg: 5,
    suitType: 'wet',
    equipmentNotes: null,
    buddyName: '田中',
    instructorName: null,
    certificationDive: false,
    notes: null,
    isPublic: false,
    publicSlug: null,
    createdAt: '2025-07-01T00:00:00Z',
    updatedAt: '2025-07-01T00:00:00Z',
    ...overrides,
});

/** BOM を除いた行配列に分解する */
const lines = (csv: string): string[] => csv.replace(/^﻿/, '').replace(/\r\n$/, '').split('\r\n');

describe('divesToCsv', () => {
    it('先頭に BOM を付与する（Excel 文字化け防止）', () => {
        expect(divesToCsv([])).toMatch(/^﻿/);
    });

    it('0 件はヘッダー行のみ', () => {
        const rows = lines(divesToCsv([]));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.startsWith('ダイブ番号,潜水日,')).toBe(true);
    });

    it('1 ダイブ 1 行で出力する', () => {
        const rows = lines(divesToCsv([buildDive(), buildDive({ id: 'd2' })]));
        expect(rows).toHaveLength(3); // header + 2
    });

    it('タンク種類を日本語ラベルに、講習ダイブを はい/空 に変換する', () => {
        const csv = divesToCsv([buildDive({ tankType: 'steel', certificationDive: true })]);
        const row = lines(csv)[1] ?? '';
        expect(row).toContain('スチール');
        expect(row.split(',')).toContain('はい');
    });

    it('講習でないダイブは空欄', () => {
        const csv = divesToCsv([buildDive({ certificationDive: false })]);
        expect(lines(csv)[1]?.endsWith(',')).toBe(true); // 末尾の notes が空 → 末尾カンマ
    });

    it('サイト参照ログはサイト名・エリアを解決する', () => {
        const csv = divesToCsv([buildDive({ location: null, diveSite: { id: 's1', name: '大瀬崎', area: '伊豆' } })]);
        const row = lines(csv)[1] ?? '';
        expect(row).toContain('伊豆 / 大瀬崎'); // ポイント列
        expect(row).toContain('伊豆'); // エリア列
    });

    it('カンマ・改行・引用符を含む値を RFC4180 でエスケープする', () => {
        const csv = divesToCsv([buildDive({ notes: 'a,b\n"c"' })]);
        // メモ列が引用で囲まれ、内部の " が "" になり、改行が値内に保持される
        expect(csv).toContain('"a,b\n""c"""');
        // 列ずれしない: ヘッダー + 1 データ行（改行はフィールド内なので行数は増えない）
        expect(lines(csv)).toHaveLength(2);
    });

    it('null / 未入力は空セルにする', () => {
        const csv = divesToCsv([buildDive({ waterTempC: null, buddyName: null })]);
        expect(csv).not.toContain('null');
    });

    it("数式インジェクション: = + @ 始まりのセルは先頭に ' を付けて無害化する", () => {
        const csv = divesToCsv([buildDive({ notes: '=SUM(A1:A9)', buddyName: '@evil' })]);
        const row = lines(csv)[1] ?? '';
        expect(row).toContain("'=SUM(A1:A9)");
        expect(row).toContain("'@evil");
    });

    it('数式インジェクション: 負数などの純粋な数値はガード対象外', () => {
        const csv = divesToCsv([buildDive({ waterTempC: -5, airTempC: -10.5 })]);
        const row = lines(csv)[1] ?? '';
        expect(row).toContain(',-5,');
        expect(row).toContain(',-10.5,');
        expect(row).not.toContain("'-5");
    });
});
