import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { geocode } from './geocode';

const mockFetch = vi.fn();

/** Google Geocoding API の成功レスポンスを組み立てる */
const geocodingResponse = (status: string, results: Array<{ lat: number; lng: number }> = []) => ({
    ok: true,
    json: async () => ({
        status,
        results: results.map(({ lat, lng }) => ({ geometry: { location: { lat, lng } } })),
    }),
});

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    mockFetch.mockReset();
});

describe('geocode', () => {
    it('解決成功で先頭結果の座標を返す', async () => {
        mockFetch.mockResolvedValue(geocodingResponse('OK', [{ lat: 34.9066, lng: 139.1325 }]));

        const result = await geocode('静岡県伊東市富戸');

        expect(result).toEqual({ lat: 34.9066, lng: 139.1325 });
        const requestedUrl = new URL(mockFetch.mock.calls[0]?.[0] as string);
        expect(requestedUrl.origin + requestedUrl.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json');
        expect(requestedUrl.searchParams.get('address')).toBe('静岡県伊東市富戸');
        expect(requestedUrl.searchParams.get('key')).toBe('test-api-key');
    });

    it('ZERO_RESULTS（特定できない住所）は null を返す', async () => {
        mockFetch.mockResolvedValue(geocodingResponse('ZERO_RESULTS'));

        await expect(geocode('あいうえお市かきくけこ 9-9-9')).resolves.toBeNull();
    });

    it('HTTP エラー・fetch 失敗は null を返す（throw しない）', async () => {
        mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
        await expect(geocode('静岡県伊東市富戸')).resolves.toBeNull();

        mockFetch.mockRejectedValue(new Error('network error'));
        await expect(geocode('静岡県伊東市富戸')).resolves.toBeNull();
    });

    it('GOOGLE_MAPS_API_KEY 未設定は API を呼ばず null を返す', async () => {
        vi.stubEnv('GOOGLE_MAPS_API_KEY', '');

        await expect(geocode('静岡県伊東市富戸')).resolves.toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('空文字・空白のみの住所は API を呼ばず null を返す', async () => {
        await expect(geocode('   ')).resolves.toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
