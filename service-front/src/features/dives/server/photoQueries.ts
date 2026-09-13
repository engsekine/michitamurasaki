import 'server-only';

import { DIVE_PHOTOS_BUCKET } from '@/features/dives/lib/photoStorage';
import {
    mapDivePhotoRow,
    selectCoverThumbPaths,
    toBrowserSignedUrl,
    toDivePhotoView,
} from '@/features/dives/lib/photoView';
import type { DivePhotoView } from '@/features/dives/types';
import { createClient } from '@/shared/lib/supabase/server';

/** 署名 URL の有効期限（秒）。詳細・公開ページのレンダリング中に有効ならよい */
const SIGNED_URL_TTL_SEC = 60 * 60;

/**
 * 複数ダイブの代表サムネイル（cover 優先）の署名 URL をまとめて解決し、diveId → URL のマップで返す。
 * TOP「最近のダイブログ」のカードサムネイルなど、一覧でカバー画像だけ欲しい用途向け。
 * 写真のないダイブはマップに載らない（呼び出し側でダミー画像にフォールバックする）。RLS で本人 or 公開のみ。
 */
export const getCoverThumbUrls = async (diveIds: string[]): Promise<Map<string, string>> => {
    if (diveIds.length === 0) return new Map();

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('dive_photos')
        .select('dive_id, thumb_path, is_cover, sort_order')
        .in('dive_id', diveIds);

    if (error) throw new Error(`[getCoverThumbUrls] supabase error: ${error.message}`);
    if (!data || data.length === 0) return new Map();

    const thumbPathByDive = selectCoverThumbPaths(
        data.map((row) => ({
            diveId: row.dive_id,
            thumbPath: row.thumb_path,
            isCover: row.is_cover,
            sortOrder: row.sort_order,
        })),
    );

    const { data: signed, error: signError } = await supabase.storage
        .from(DIVE_PHOTOS_BUCKET)
        .createSignedUrls([...thumbPathByDive.values()], SIGNED_URL_TTL_SEC);

    if (signError || !signed) {
        throw new Error(`[getCoverThumbUrls] signed url error: ${signError?.message ?? 'no data'}`);
    }

    const publicBaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const urlByPath = new Map<string, string>();
    for (const item of signed) {
        if (item.path && item.signedUrl) {
            urlByPath.set(item.path, toBrowserSignedUrl(item.signedUrl, publicBaseUrl));
        }
    }

    const result = new Map<string, string>();
    for (const [diveId, thumbPath] of thumbPathByDive) {
        const url = urlByPath.get(thumbPath);
        if (url) result.set(diveId, url);
    }
    return result;
};

/**
 * ダイブログの写真を sort_order 昇順で取得し、表示用署名 URL を解決して返す（FR-002 / FR-010）。
 * RLS により本人 or 公開ログの写真のみ取得される。0 枚は空配列。
 * 純粋な変換ロジックは lib/photoView.ts（単体テスト対象）。本関数は I/O のみ。
 */
export const getDivePhotos = async (diveId: string, altFallback: string): Promise<DivePhotoView[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('dive_photos')
        .select('*')
        .eq('dive_id', diveId)
        .order('sort_order', { ascending: true });

    if (error) throw new Error(`[getDivePhotos] supabase error: ${error.message}`);
    if (!data || data.length === 0) return [];

    const photos = data.map(mapDivePhotoRow);
    const paths = photos.flatMap((photo) => [photo.displayPath, photo.thumbPath]);

    const { data: signed, error: signError } = await supabase.storage
        .from(DIVE_PHOTOS_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SEC);

    if (signError || !signed) {
        throw new Error(`[getDivePhotos] signed url error: ${signError?.message ?? 'no data'}`);
    }

    // サーバーは内部 URL で署名するため、ブラウザ表示用に公開 URL のホストへ差し替える
    const publicBaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const signedUrlByPath = new Map<string, string>();
    for (const item of signed) {
        if (item.path && item.signedUrl) {
            signedUrlByPath.set(item.path, toBrowserSignedUrl(item.signedUrl, publicBaseUrl));
        }
    }

    return photos
        .map((photo) => toDivePhotoView(photo, signedUrlByPath, altFallback))
        .filter((view): view is DivePhotoView => view !== null);
};
