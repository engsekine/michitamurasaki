import 'server-only';

const GEOCODING_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

interface GeocodingApiResponse {
    status: string;
    results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
}

/**
 * Google Geocoding API で住所を座標に解決する（research.md Decision 2）。
 * 解決できない場合（ZERO_RESULTS・API 障害・キー未設定・空住所）はすべて null を返し、
 * 呼び出し側（保存・地図プレビュー）を失敗させない（FR-013）。
 */
export const geocode = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    const trimmed = address.trim();
    if (!trimmed) return null;

    const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
    if (!apiKey) return null;

    const url = new URL(GEOCODING_ENDPOINT);
    url.searchParams.set('address', trimmed);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'ja');

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.error(`[geocode] HTTP error: ${response.status ?? 'unknown'}`);
            return null;
        }

        const body = (await response.json()) as GeocodingApiResponse;
        const location = body.results[0]?.geometry.location;
        if (body.status !== 'OK' || !location) return null;

        return { lat: location.lat, lng: location.lng };
    } catch (error) {
        console.error('[geocode] fetch error:', error);
        return null;
    }
};
