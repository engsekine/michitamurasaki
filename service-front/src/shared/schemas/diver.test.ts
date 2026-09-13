import { describe, expect, it } from 'vitest';
import * as yup from 'yup';

import { optionalDiverFields, requiredDiverFields } from './diver';

const requiredSchema = yup.object({ ...requiredDiverFields });
const optionalSchema = yup.object({ ...optionalDiverFields });

describe('requiredDiverFields（登録）', () => {
    it('種別未選択は reject する', () => {
        expect(() => requiredSchema.validateSync({})).toThrow('ダイバー種別を選択してください');
    });

    it('一般ダイバーは番号なしで通過し、番号は出力から除外される', () => {
        const result = requiredSchema.validateSync({ diverType: 'general', diverNumber: 'X123' });
        expect(result.diverType).toBe('general');
        expect(result.diverNumber).toBeUndefined();
    });

    it('インストラクターは番号を保持する', () => {
        const result = requiredSchema.validateSync({ diverType: 'instructor', diverNumber: 'PADI-12345' });
        expect(result.diverNumber).toBe('PADI-12345');
    });

    it('インストラクターは番号未入力でも通過し、空文字は null に正規化される', () => {
        const result = requiredSchema.validateSync({ diverType: 'instructor', diverNumber: '' });
        expect(result.diverNumber).toBeNull();
    });

    it('インストラクターの番号が 51 文字なら reject する', () => {
        expect(() => requiredSchema.validateSync({ diverType: 'instructor', diverNumber: 'a'.repeat(51) })).toThrow(
            'ダイバー番号は50文字以内で入力してください',
        );
    });
});

describe('optionalDiverFields（プロフィール編集）', () => {
    it('種別未選択でも通過する（既存ユーザーを非ブロック）', () => {
        expect(() => optionalSchema.validateSync({})).not.toThrow();
    });
});
