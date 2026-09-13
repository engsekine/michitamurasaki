import { describe, expect, it } from 'vitest';
import * as yup from 'yup';

import { validateWithSchema } from './validation';

const schema = yup.object({
    name: yup.string().trim().required('名前を入力してください').max(5, '名前は5文字以内で入力してください'),
});

describe('validateWithSchema', () => {
    it('成功時は trim 済みの values を返す', async () => {
        const result = await validateWithSchema(schema, { name: '  太郎  ' });

        expect(result.error).toBeUndefined();
        expect(result.values).toEqual({ name: '太郎' });
    });

    it('検証失敗時はエラーメッセージを返す', async () => {
        const result = await validateWithSchema(schema, { name: '' });

        expect(result.values).toBeUndefined();
        expect(result.error).toBe('名前を入力してください');
    });

    it('ValidationError 以外は再 throw する', async () => {
        const throwingSchema = {
            validate: () => {
                throw new TypeError('boom');
            },
        } as unknown as yup.Schema<string>;

        await expect(validateWithSchema(throwingSchema, 'x')).rejects.toThrow('boom');
    });
});
