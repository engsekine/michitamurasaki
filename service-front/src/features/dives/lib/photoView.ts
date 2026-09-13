import type { Database } from '@repo/supabase';

import type { DivePhoto, DivePhotoView } from '@/features/dives/types';

type DivePhotoRow = Database['public']['Tables']['dive_photos']['Row'];

/** DB 行（snake_case）をドメイン型へ変換する純粋関数 */
export const mapDivePhotoRow = (row: DivePhotoRow): DivePhoto => ({
    id: row.id,
    diveId: row.dive_id,
    displayPath: row.display_path,
    thumbPath: row.thumb_path,
    caption: row.caption,
    sortOrder: row.sort_order,
    isCover: row.is_cover,
    width: row.width,
    height: row.height,
});

/** カバーサムネイル選定用の最小情報 */
export interface CoverThumbRef {
    diveId: string;
    thumbPath: string;
    isCover: boolean;
    sortOrder: number;
}

/**
 * ダイブごとに代表サムネイルの Storage パスを 1 つ選ぶ純粋関数。
 * 優先順位は「cover フラグ → sort_order 昇順」。写真のないダイブはマップに載らない。
 */
export const selectCoverThumbPaths = (refs: CoverThumbRef[]): Map<string, string> => {
    const bestByDive = new Map<string, CoverThumbRef>();
    for (const ref of refs) {
        const current = bestByDive.get(ref.diveId);
        if (!current) {
            bestByDive.set(ref.diveId, ref);
            continue;
        }
        // cover を最優先、同条件なら sort_order の小さい方
        const isBetter =
            (ref.isCover && !current.isCover) || (ref.isCover === current.isCover && ref.sortOrder < current.sortOrder);
        if (isBetter) bestByDive.set(ref.diveId, ref);
    }

    return new Map([...bestByDive].map(([diveId, ref]) => [diveId, ref.thumbPath]));
};

/** alt はキャプション優先、無ければログ情報由来のフォールバック（FR-009 系 / accessibility.md） */
export const buildPhotoAlt = (caption: string, fallback: string): string => {
    const trimmed = caption.trim();
    return trimmed.length > 0 ? trimmed : fallback;
};

/**
 * 署名 URL のホストをブラウザ到達可能な公開 URL に差し替える。
 * サーバーは内部 URL（dev の host.docker.internal 等）で署名するため、
 * そのままだとブラウザから到達できず next/image の remotePatterns にも一致しない。
 * トークンはオブジェクトパスに対して発行されホスト非依存なので、ホストのみ差し替えてよい。
 * publicBaseUrl 未設定 / パース不能時は元の URL をそのまま返す。
 */
export const toBrowserSignedUrl = (signedUrl: string, publicBaseUrl: string | undefined): string => {
    if (!publicBaseUrl) return signedUrl;
    try {
        const url = new URL(signedUrl);
        const base = new URL(publicBaseUrl);
        url.protocol = base.protocol;
        url.hostname = base.hostname;
        // host 経由だとポートなしの公開 URL で元ポートが残るため、hostname / port を個別に設定する
        url.port = base.port;
        return url.toString();
    } catch {
        return signedUrl;
    }
};

/** 署名 URL を解決して表示用 View に変換する。URL 解決に失敗した写真は null（除外用） */
export const toDivePhotoView = (
    photo: DivePhoto,
    signedUrlByPath: Map<string, string>,
    altFallback: string,
): DivePhotoView | null => {
    const displayUrl = signedUrlByPath.get(photo.displayPath);
    const thumbUrl = signedUrlByPath.get(photo.thumbPath);
    if (!displayUrl || !thumbUrl) return null;
    return {
        id: photo.id,
        displayUrl,
        thumbUrl,
        caption: photo.caption,
        isCover: photo.isCover,
        width: photo.width,
        height: photo.height,
        alt: buildPhotoAlt(photo.caption, altFallback),
    };
};
