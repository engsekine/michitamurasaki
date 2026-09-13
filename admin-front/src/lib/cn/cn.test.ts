import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
    it('複数のクラスを結合する', () => {
        expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
    });

    it('falsy な値を無視する', () => {
        expect(cn('px-2', false, null, undefined, 'py-1')).toBe('px-2 py-1');
    });

    it('条件付きクラス（オブジェクト記法）を解決する', () => {
        expect(cn('px-2', { 'text-red-500': true, 'text-blue-500': false })).toBe('px-2 text-red-500');
    });

    it('競合する Tailwind クラスは後勝ちでマージする', () => {
        expect(cn('px-2', 'px-4')).toBe('px-4');
        expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });
});
