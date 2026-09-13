import { describe, expect, it } from 'vitest';

import {
    SHOP_ADDRESS_MAX_LENGTH,
    SHOP_MEMO_MAX_LENGTH,
    SHOP_NAME_MAX_LENGTH,
    SHOP_PHONE_MAX_LENGTH,
} from '../constants';
import { shopSchema } from './shop.schema';

/** 全項目が妥当な入力 */
const validInput = {
    name: 'マリンステージ',
    address: '静岡県伊東市富戸 837-2',
    phone: '0557-51-3535',
    websiteUrl: 'https://example.com/shop',
    memo: '送迎あり。器材レンタルが安い',
};

describe('shopSchema', () => {
    it('全項目が妥当なら通過し trim される', async () => {
        const values = await shopSchema.validate({ ...validInput, name: '  マリンステージ  ' });
        expect(values.name).toBe('マリンステージ');
        expect(values.address).toBe(validInput.address);
    });

    it('名前のみ（他は空）でも通過し、空項目は空文字に正規化される', async () => {
        const values = await shopSchema.validate({
            name: 'ショップ A',
            address: '',
            phone: '',
            websiteUrl: '',
            memo: '',
        });
        expect(values).toEqual({ name: 'ショップ A', address: '', phone: '', websiteUrl: '', memo: '' });
    });

    describe('name', () => {
        it('空はエラー', async () => {
            await expect(shopSchema.validate({ ...validInput, name: '' })).rejects.toThrow(
                'ショップ名を入力してください',
            );
        });

        it('空白のみはエラー', async () => {
            await expect(shopSchema.validate({ ...validInput, name: '   ' })).rejects.toThrow(
                'ショップ名を入力してください',
            );
        });

        it(`${SHOP_NAME_MAX_LENGTH} 文字は通過、${SHOP_NAME_MAX_LENGTH + 1} 文字はエラー`, async () => {
            await expect(
                shopSchema.validate({ ...validInput, name: 'あ'.repeat(SHOP_NAME_MAX_LENGTH) }),
            ).resolves.toBeTruthy();
            await expect(
                shopSchema.validate({ ...validInput, name: 'あ'.repeat(SHOP_NAME_MAX_LENGTH + 1) }),
            ).rejects.toThrow(`ショップ名は${SHOP_NAME_MAX_LENGTH}文字以内で入力してください`);
        });
    });

    describe('address', () => {
        it(`${SHOP_ADDRESS_MAX_LENGTH + 1} 文字はエラー`, async () => {
            await expect(
                shopSchema.validate({ ...validInput, address: 'あ'.repeat(SHOP_ADDRESS_MAX_LENGTH + 1) }),
            ).rejects.toThrow(`住所は${SHOP_ADDRESS_MAX_LENGTH}文字以内で入力してください`);
        });
    });

    describe('phone', () => {
        it.each(['0557-51-3535', '09012345678', '+81-90-1234-5678'])('%s は通過', async (phone) => {
            await expect(shopSchema.validate({ ...validInput, phone })).resolves.toBeTruthy();
        });

        it.each(['电话', 'abc-1234', '090 1234 5678'])('%s はエラー', async (phone) => {
            await expect(shopSchema.validate({ ...validInput, phone })).rejects.toThrow(
                '電話番号は数字・ハイフン・+ で入力してください',
            );
        });

        it(`${SHOP_PHONE_MAX_LENGTH + 1} 文字はエラー`, async () => {
            await expect(
                shopSchema.validate({ ...validInput, phone: '1'.repeat(SHOP_PHONE_MAX_LENGTH + 1) }),
            ).rejects.toThrow(`電話番号は${SHOP_PHONE_MAX_LENGTH}文字以内で入力してください`);
        });
    });

    describe('websiteUrl', () => {
        it.each(['https://example.com', 'http://example.com/path?q=1'])('%s は通過', async (websiteUrl) => {
            await expect(shopSchema.validate({ ...validInput, websiteUrl })).resolves.toBeTruthy();
        });

        it.each(['htp://example.com', 'example', 'ftp://example.com'])('%s はエラー', async (websiteUrl) => {
            await expect(shopSchema.validate({ ...validInput, websiteUrl })).rejects.toThrow(
                'Web サイト URL は http(s):// から始まる URL を入力してください',
            );
        });
    });

    describe('memo', () => {
        it(`${SHOP_MEMO_MAX_LENGTH + 1} 文字はエラー`, async () => {
            await expect(
                shopSchema.validate({ ...validInput, memo: 'あ'.repeat(SHOP_MEMO_MAX_LENGTH + 1) }),
            ).rejects.toThrow(`メモは${SHOP_MEMO_MAX_LENGTH}文字以内で入力してください`);
        });
    });
});
