/**
 * yup の transform 用ヘルパー（Web / モバイル共有。service-front の shared/schemas/transforms から移設）。
 * フォームの空入力（'' / null / undefined）を null に正規化する。
 */

/** 空文字 / null / undefined を null に、それ以外は yup の number 変換結果を返す */
export const optionalNumber = (value: number, originalValue: unknown): number | null => {
    if (originalValue === '' || originalValue == null) return null;
    return value;
};

/** 空文字 / null / undefined を null に、それ以外は文字列をそのまま返す */
export const optionalString = (value: string | null | undefined): string | null => {
    if (value === '' || value == null) return null;
    return value;
};
