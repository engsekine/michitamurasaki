import { describe, expect, it } from 'vitest';

import { buildContactDefaultValues } from './prefill';

describe('buildContactDefaultValues', () => {
    it('ログイン中は氏名（姓+名）とメールを補完する', () => {
        const values = buildContactDefaultValues({ last_name: '山田', first_name: '太郎' }, 'taro@example.com');

        expect(values).toEqual({
            name: '山田太郎',
            email: 'taro@example.com',
            category: '',
            body: '',
            website: '',
        });
    });

    it('未ログイン（detail/email なし）は空の初期値を返す', () => {
        const values = buildContactDefaultValues(null, null);

        expect(values).toEqual({ name: '', email: '', category: '', body: '', website: '' });
    });

    it('姓または名が null でも欠損なく結合する', () => {
        expect(buildContactDefaultValues({ last_name: '山田', first_name: null }, null).name).toBe('山田');
        expect(buildContactDefaultValues({ last_name: null, first_name: '太郎' }, null).name).toBe('太郎');
    });
});
