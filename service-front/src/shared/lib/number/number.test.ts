import { toNumber } from './number';

describe('toNumber', () => {
    it('数値はそのまま返す', () => {
        expect(toNumber(170.5)).toBe(170.5);
        expect(toNumber(0)).toBe(0);
    });

    it('数値文字列を数値に変換する', () => {
        expect(toNumber('60.5')).toBe(60.5);
        expect(toNumber('170')).toBe(170);
    });

    it('null / undefined は null を返す', () => {
        expect(toNumber(null)).toBeNull();
        expect(toNumber(undefined)).toBeNull();
    });

    it('数値に変換できない文字列は null を返す', () => {
        expect(toNumber('abc')).toBeNull();
    });
});
