import { CONTACT_LENS_TYPE_OPTIONS, RENTAL_ITEMS, SHEET_GENDER_OPTIONS } from '../../constants';
import type { SheetFormValues, YesNoValue } from '../../types';

/** 未入力は（ ）の空欄のまま出力する（FR-005） */
const paren = (value: string): string => `（${value === '' ? ' ' : value}）`;

/** 単位付きの括弧。未入力でも単位は残す（例:（ 歳）/（52 本）） */
const parenWithUnit = (value: string, unit: string): string => `（${value === '' ? ' ' : `${value} `}${unit}）`;

const yesNoLabel = (value: YesNoValue): string => {
    if (value === 'yes') return '有';
    if (value === 'no') return '無';
    return '';
};

const needsMaskLabel = (value: YesNoValue): string => {
    if (value === 'yes') return '要';
    if (value === 'no') return '不要';
    return '';
};

/** '05' → '5' のようにゼロ埋めを外す（出力テキストの表記に合わせる） */
const stripLeadingZero = (value: string): string => String(Number(value));

/** YYYY-MM-DD →「西暦 {年} 年 {月} 月 {日} 日」（未入力は空欄のままラベルだけ残す） */
const formatBirthOn = (birthOn: string): string => {
    const [year, month, day] = birthOn.split('-');
    if (!year || !month || !day) return '（西暦 年 月 日）';
    return `（西暦 ${year} 年 ${stripLeadingZero(month)} 月 ${stripLeadingZero(day)} 日）`;
};

/** 「YYYY年M月」→「{年} 年 {月} 月」（未入力は空欄のままラベルだけ残す） */
const formatYearMonth = (yearMonthDisplay: string): string => {
    const matched = yearMonthDisplay.match(/^(\d{4})年(\d{1,2})月$/);
    if (!matched?.[1] || !matched[2]) return '（ 年 月）';
    return `（${matched[1]} 年 ${stripLeadingZero(matched[2])} 月）`;
};

/** 「身長:172.5 cm」のような単位付き記入欄（未入力は「身長: cm」とラベル・単位のみ） */
const measureLine = (label: string, value: string, unit: string): string => `${label}:${value} ${unit}`;

const genderLabel = (gender: SheetFormValues['gender']): string =>
    SHEET_GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? '';

/** コンタクト「有」のときだけ種類を出力する（それ以外は空欄） */
const contactLensTypeLabel = (values: SheetFormValues): string => {
    if (values.hasContactLens !== 'yes') return '';
    return CONTACT_LENS_TYPE_OPTIONS.find((option) => option.value === values.contactLensType)?.label ?? '';
};

/**
 * フォーム値から申し込みシートの定型テキストを生成する純関数（FR-004/005/012）。
 * 並び・体裁は contracts/application-sheet-page.md の出力テキスト契約が正。
 */
export const buildSheetText = (values: SheetFormValues): string => {
    const lines: string[] = [
        `・お名前${paren(values.fullName)}`,
        `・年齢${parenWithUnit(values.age, '歳')}`,
        `・生年月日${formatBirthOn(values.birthOn)}`,
        `・性別${paren(genderLabel(values.gender))}`,
        `・携帯電話${paren(values.phone)}`,
        `・緊急連絡先 続柄${paren(values.emergencyContactRelation)}${paren(values.emergencyContactPhone)}`,
        `・最寄りの駅${paren(values.nearestStation)}`,
        `・ライセンス ランク${paren(values.licenseRank)}`,
        `・経験本数${parenWithUnit(values.diveCount, '本')}`,
        `・最終ダイブ年月${formatYearMonth(values.lastDiveYearMonth)}`,
        `・ドライスーツの経験${paren(yesNoLabel(values.hasDrySuitExperience))}`,
        `・ドライの経験本数 約${parenWithUnit(values.drySuitDiveCount, '本')}`,
        '',
        `・レンタル器材${paren(yesNoLabel(values.hasRental))}`,
    ];

    // レンタル「無」+ 省略トグル ON のときだけ品目〜度付きマスクのブロックを省く（FR-012）
    const shouldOmitRentalBlock = values.hasRental === 'no' && values.omitRentalBlock;
    if (!shouldOmitRentalBlock) {
        lines.push(
            '',
            'ありの場合レンタルしたいものに○を付けてください',
            '',
            ...RENTAL_ITEMS.map(({ key, label }) => `${label}:${values.rentalItems.includes(key) ? ' ○' : ''}`),
            '',
            '・ウェット・ドライスーツレンタルの方',
            measureLine('身長', values.heightCm, 'cm'),
            measureLine('体重', values.weightKg, 'kg'),
            measureLine('足のサイズ', values.footSizeCm, 'cm'),
            '',
            `・コンタクトレンズ有無${paren(yesNoLabel(values.hasContactLens))}`,
            `有りの方 → ハード or ソフト or 使い捨て${paren(contactLensTypeLabel(values))}`,
            '',
            `・度付きのマスクレンタル必要の有無${paren(needsMaskLabel(values.needsPrescriptionMask))}`,
        );
    }

    return lines.join('\n');
};
