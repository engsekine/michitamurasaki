import { describe, expect, it } from 'vitest';

import type { SheetFormValues } from '../../types';
import { buildSheetText } from './buildSheetText';

/** 全項目未入力（フォーム初期状態） */
const emptyValues: SheetFormValues = {
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
    diveShopId: '',
};

const filledValues: SheetFormValues = {
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
};

/** 出力テキスト契約（contracts/application-sheet-page.md）: 全項目空欄の全文 */
const expectedEmptyText = [
    '・お名前（ ）',
    '・年齢（ 歳）',
    '・生年月日（西暦 年 月 日）',
    '・性別（ ）',
    '・携帯電話（ ）',
    '・緊急連絡先 続柄（ ）（ ）',
    '・最寄りの駅（ ）',
    '・ライセンス ランク（ ）',
    '・経験本数（ 本）',
    '・最終ダイブ年月（ 年 月）',
    '・ドライスーツの経験（ ）',
    '・ドライの経験本数 約（ 本）',
    '',
    '・レンタル器材（ ）',
    '',
    'ありの場合レンタルしたいものに○を付けてください',
    '',
    'ウエットスーツフルセット:',
    'ドライスーツフルセット:',
    'マスク スノーケル:',
    'フィン:',
    'グローブ:',
    'ブーツ:',
    'ウエットスーツ:',
    'ウエットベスト:',
    'ドライスーツ:',
    'BC:',
    'レギュレーター:',
    'ダイビングコンピューター:',
    '水中ライト:',
    '水中カメラ:',
    '',
    '・ウェット・ドライスーツレンタルの方',
    '身長: cm',
    '体重: kg',
    '足のサイズ: cm',
    '',
    '・コンタクトレンズ有無（ ）',
    '有りの方 → ハード or ソフト or 使い捨て（ ）',
    '',
    '・度付きのマスクレンタル必要の有無（ ）',
].join('\n');

/** 出力テキスト契約: 全項目入力済みの全文（選択品目のみ ○・単位と年月日の整形込み） */
const expectedFilledText = [
    '・お名前（山田 太郎）',
    '・年齢（36 歳）',
    '・生年月日（西暦 1990 年 5 月 3 日）',
    '・性別（男性）',
    '・携帯電話（090-1234-5678）',
    '・緊急連絡先 続柄（妻）（080-9876-5432）',
    '・最寄りの駅（横浜駅）',
    '・ライセンス ランク（Open Water Diver）',
    '・経験本数（52 本）',
    '・最終ダイブ年月（2026 年 5 月）',
    '・ドライスーツの経験（無）',
    '・ドライの経験本数 約（10 本）',
    '',
    '・レンタル器材（有）',
    '',
    'ありの場合レンタルしたいものに○を付けてください',
    '',
    'ウエットスーツフルセット: ○',
    'ドライスーツフルセット:',
    'マスク スノーケル:',
    'フィン: ○',
    'グローブ:',
    'ブーツ:',
    'ウエットスーツ:',
    'ウエットベスト:',
    'ドライスーツ:',
    'BC:',
    'レギュレーター:',
    'ダイビングコンピューター:',
    '水中ライト:',
    '水中カメラ:',
    '',
    '・ウェット・ドライスーツレンタルの方',
    '身長:172.5 cm',
    '体重:65 kg',
    '足のサイズ:26.5 cm',
    '',
    '・コンタクトレンズ有無（有）',
    '有りの方 → ハード or ソフト or 使い捨て（ソフト）',
    '',
    '・度付きのマスクレンタル必要の有無（不要）',
].join('\n');

describe('buildSheetText', () => {
    it('全項目空欄でも定型フォーマットの全文を出力する（FR-005）', () => {
        expect(buildSheetText(emptyValues)).toBe(expectedEmptyText);
    });

    it('全項目入力済みの全文を契約どおりの並び・体裁で出力する（FR-004 / SC-002）', () => {
        expect(buildSheetText(filledValues)).toBe(expectedFilledText);
    });

    it('選択したレンタル品目のみ ○ が付く（FR-003）', () => {
        const text = buildSheetText({ ...emptyValues, hasRental: 'yes', rentalItems: ['bc', 'regulator'] });
        expect(text).toContain('BC: ○');
        expect(text).toContain('レギュレーター: ○');
        expect(text).toContain('フィン:\n');
        expect(text).not.toContain('フィン: ○');
    });

    it('レンタル「無」+ トグル OFF では品目〜サイズ欄も空欄のまま全文出力する（FR-012 デフォルト）', () => {
        const text = buildSheetText({ ...emptyValues, hasRental: 'no', omitRentalBlock: false });
        expect(text).toContain('・レンタル器材（無）');
        expect(text).toContain('ありの場合レンタルしたいものに○を付けてください');
        expect(text).toContain('足のサイズ: cm');
    });

    it('レンタル「無」+ トグル ON では品目〜サイズ欄ブロックを省略する（FR-012）', () => {
        const text = buildSheetText({ ...emptyValues, hasRental: 'no', omitRentalBlock: true });
        const expected = [
            '・お名前（ ）',
            '・年齢（ 歳）',
            '・生年月日（西暦 年 月 日）',
            '・性別（ ）',
            '・携帯電話（ ）',
            '・緊急連絡先 続柄（ ）（ ）',
            '・最寄りの駅（ ）',
            '・ライセンス ランク（ ）',
            '・経験本数（ 本）',
            '・最終ダイブ年月（ 年 月）',
            '・ドライスーツの経験（ ）',
            '・ドライの経験本数 約（ 本）',
            '',
            '・レンタル器材（無）',
        ].join('\n');
        expect(text).toBe(expected);
    });

    it('省略トグル ON ではコンタクトレンズの有無・種類・度付きマスクもレンタルブロックとして省略される', () => {
        const text = buildSheetText({
            ...emptyValues,
            hasRental: 'no',
            omitRentalBlock: true,
            hasContactLens: 'yes',
            contactLensType: 'soft',
        });
        expect(text).not.toContain('・コンタクトレンズ有無');
        expect(text).not.toContain('有りの方 → ハード or ソフト or 使い捨て');
        expect(text).not.toContain('・度付きのマスクレンタル必要の有無');
    });

    it('レンタル「有」ではトグル ON でもブロックを省略しない（省略は「無」時のみ）', () => {
        const text = buildSheetText({ ...emptyValues, hasRental: 'yes', omitRentalBlock: true });
        expect(text).toContain('ありの場合レンタルしたいものに○を付けてください');
    });

    it('生年月日・最終ダイブ年月の月日はゼロ埋めなしに整形される', () => {
        const text = buildSheetText({ ...emptyValues, birthOn: '2001-01-09', lastDiveYearMonth: '2026年07月' });
        expect(text).toContain('・生年月日（西暦 2001 年 1 月 9 日）');
        expect(text).toContain('・最終ダイブ年月（2026 年 7 月）');
    });

    it('コンタクト「無」のときは種類を選んでいても空欄で出力する', () => {
        const text = buildSheetText({ ...emptyValues, hasContactLens: 'no', contactLensType: 'soft' });
        expect(text).toContain('・コンタクトレンズ有無（無）');
        expect(text).toContain('有りの方 → ハード or ソフト or 使い捨て（ ）');
    });

    it('度付きマスクは要 / 不要で出力される', () => {
        const yes = buildSheetText({ ...emptyValues, needsPrescriptionMask: 'yes' });
        expect(yes).toContain('・度付きのマスクレンタル必要の有無（要）');
        const no = buildSheetText({ ...emptyValues, needsPrescriptionMask: 'no' });
        expect(no).toContain('・度付きのマスクレンタル必要の有無（不要）');
    });
});
