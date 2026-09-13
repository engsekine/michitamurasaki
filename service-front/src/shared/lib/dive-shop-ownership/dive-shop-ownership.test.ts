import { describe, expect, it, vi } from 'vitest';

import { isOwnDiveShop } from './dive-shop-ownership';

type SupabaseLike = Parameters<typeof isOwnDiveShop>[0];

/** isOwnDiveShop が呼ぶ範囲（from().select().eq().maybeSingle()）だけを再現したモック */
const buildSupabaseMock = (row: { id: string } | null) => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const from = vi.fn(() => ({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
    }));
    return { client: { from } as unknown as SupabaseLike, from };
};

describe('isOwnDiveShop', () => {
    it('本人のショップ（RLS で取得できる）は true', async () => {
        const { client } = buildSupabaseMock({ id: 'shop-1' });
        await expect(isOwnDiveShop(client, 'shop-1')).resolves.toBe(true);
    });

    it('取得できない id（他人のショップ・存在しない id）は false', async () => {
        const { client } = buildSupabaseMock(null);
        await expect(isOwnDiveShop(client, 'shop-x')).resolves.toBe(false);
    });

    it('未選択（null・空文字）は DB を参照せず true', async () => {
        const { client, from } = buildSupabaseMock(null);

        await expect(isOwnDiveShop(client, null)).resolves.toBe(true);
        await expect(isOwnDiveShop(client, '')).resolves.toBe(true);
        expect(from).not.toHaveBeenCalled();
    });
});
