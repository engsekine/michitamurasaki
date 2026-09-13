'use client';

import Image from 'next/image';
import { DeleteDivePhotoButton } from '@/features/dives/components/client/DeleteDivePhotoButton';
import type { DivePhotoView } from '@/features/dives/types';
import { PhotoThumbnail } from '@/shared/components/media/PhotoThumbnail';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/components/ui/Dialog';

interface DivePhotoGalleryProps {
    /** 表示順に並んだ写真（署名 URL 解決済み）。0 枚なら何も描画しない */
    photos: DivePhotoView[];
    /** 本人として写真を削除できるか。公開ページなどでは false（既定） */
    canManage?: boolean;
}

/**
 * ダイブログの写真ギャラリー（Client Component）。
 * サムネイルをクリックするとモーダル（shadcn Dialog）で拡大表示する。
 * データ取得は呼び出し側（ページ）が `getDivePhotos` で行い、ここは表示のみ。
 * 詳細ページ・公開ページの双方で再利用する。
 */
export const DivePhotoGallery = ({ photos, canManage = false }: DivePhotoGalleryProps) => {
    if (photos.length === 0) return null;

    return (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
                <li key={photo.id}>
                    <Dialog>
                        <DialogTrigger
                            aria-label={`${photo.alt} を拡大表示`}
                            className="block w-full overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                            {/* 署名 URL は最適化キャッシュが効かず、dev の Docker では optimizer が到達できないため直接読み込む */}
                            <PhotoThumbnail src={photo.thumbUrl} alt={photo.alt} unoptimized />
                        </DialogTrigger>
                        <DialogContent className="w-auto max-w-[95vw] sm:max-w-4xl">
                            <DialogTitle className="sr-only">{photo.alt}</DialogTitle>
                            {photo.caption ? (
                                <DialogDescription className="sr-only">{photo.caption}</DialogDescription>
                            ) : null}
                            {/* 固有サイズ（表示画像の幅・高さ）で描画し、画面に収まるよう max 制約で縮小する。
                                fill だと w-auto のコンテナ幅が 0 に潰れて表示されないため使わない */}
                            <Image
                                src={photo.displayUrl}
                                alt={photo.alt}
                                width={photo.width ?? 1200}
                                height={photo.height ?? 800}
                                unoptimized
                                sizes="95vw"
                                className="h-auto max-h-[80vh] w-auto max-w-full rounded-md object-contain"
                            />
                            {photo.caption && <p className="text-muted-foreground text-sm">{photo.caption}</p>}
                            {canManage && (
                                <div className="flex justify-end">
                                    <DeleteDivePhotoButton photoId={photo.id} />
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </li>
            ))}
        </ul>
    );
};
