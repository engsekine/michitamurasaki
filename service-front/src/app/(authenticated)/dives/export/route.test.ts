import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('@/features/dives/server/export-query', () => ({ fetchDivesForExport: vi.fn() }));

import { createClient as createBearerClient } from '@supabase/supabase-js';

import { fetchDivesForExport } from '@/features/dives/server/export-query';
import { createClient } from '@/shared/lib/supabase/server';

import { GET } from './route';

const mockedCookieClient = vi.mocked(createClient);
const mockedBearerClient = vi.mocked(createBearerClient);
const mockedFetchDives = vi.mocked(fetchDivesForExport);

const USER_ID = '11111111-1111-1111-1111-111111111111';

const buildAuthClient = (user: { id: string } | null) =>
    ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } }) as never;

const request = (url: string, headers: Record<string, string> = {}) =>
    new NextRequest(new URL(url, 'https://localhost:3000'), { headers });

beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchDives.mockResolvedValue([]);
});

describe('GET /dives/export の認証（029: Bearer 対応 / 014: cookie 維持）', () => {
    it('cookie セッション（Authorization ヘッダーなし）は従来どおり認証される', async () => {
        mockedCookieClient.mockResolvedValue(buildAuthClient({ id: USER_ID }));

        const response = await GET(request('/dives/export?format=csv'));

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain('text/csv');
        expect(mockedCookieClient).toHaveBeenCalled();
        expect(mockedBearerClient).not.toHaveBeenCalled();
    });

    it('Bearer トークンがあれば supabase-js クライアントで認証する（モバイル / FR-015）', async () => {
        mockedBearerClient.mockReturnValue(buildAuthClient({ id: USER_ID }));

        const response = await GET(request('/dives/export?format=csv', { authorization: 'Bearer valid-token' }));

        expect(response.status).toBe(200);
        expect(mockedBearerClient).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.objectContaining({
                global: { headers: { Authorization: 'Bearer valid-token' } },
            }),
        );
        // cookie クライアントは作らない
        expect(mockedCookieClient).not.toHaveBeenCalled();
    });

    it('Bearer トークンが無効（getUser が null）なら 401', async () => {
        mockedBearerClient.mockReturnValue(buildAuthClient(null));

        const response = await GET(request('/dives/export?format=csv', { authorization: 'Bearer bad-token' }));

        expect(response.status).toBe(401);
        expect(mockedFetchDives).not.toHaveBeenCalled();
    });

    it('未認証（cookie もヘッダーも無し）は 401 のまま', async () => {
        mockedCookieClient.mockResolvedValue(buildAuthClient(null));

        const response = await GET(request('/dives/export?format=csv'));

        expect(response.status).toBe(401);
    });
});
