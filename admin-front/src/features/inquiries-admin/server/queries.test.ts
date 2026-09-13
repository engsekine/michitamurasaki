import { afterEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock('@/features/admin-auth', () => ({ requireAdmin }));

const { listResource } = vi.hoisted(() => ({ listResource: vi.fn() }));
vi.mock('@/shared/lib/resource/queries', () => ({ listResource }));

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createClient }));

import { INQUIRY_SEARCH_COLUMNS, INQUIRY_SORTABLE_COLUMNS, listInquiries } from './queries';

describe('listInquiries', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('requireAdmin を経て inquiries を許可リスト付きで listResource に委譲する', async () => {
        requireAdmin.mockResolvedValue({ id: 'admin-1' });
        const fakeClient = {};
        createClient.mockResolvedValue(fakeClient);
        listResource.mockResolvedValue({ rows: [], total: 0, page: 1, perPage: 20 });

        await listInquiries({ page: 1, perPage: 20, search: 'foo', sort: { column: 'created_at', ascending: false } });

        expect(requireAdmin).toHaveBeenCalledTimes(1);
        expect(listResource).toHaveBeenCalledWith(
            fakeClient,
            'inquiries',
            'id, name, email, category, created_at',
            expect.objectContaining({
                searchColumns: INQUIRY_SEARCH_COLUMNS,
                sortableColumns: INQUIRY_SORTABLE_COLUMNS,
                hasDeletedAt: false,
            }),
        );
    });

    it('検索対象は氏名・メール、ソート可能列は受付日時のみ', () => {
        expect(INQUIRY_SEARCH_COLUMNS).toEqual(['name', 'email']);
        expect(INQUIRY_SORTABLE_COLUMNS).toEqual(['created_at']);
    });
});
