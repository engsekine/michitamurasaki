import { MAP_UNAVAILABLE_MESSAGE } from '@/features/shops/constants';

interface ShopMapProps {
    /** ジオコーディング済みの座標。null = 位置を特定できない（longitude とセット） */
    latitude: number | null;
    longitude: number | null;
    /** iframe の title に使うショップ名（a11y） */
    shopName: string;
}

/**
 * ショップ位置の Google マップ埋め込み（033 / FR-011・FR-012）。
 * 座標指定の iframe のためキー・追加ライブラリ不要（research.md Decision 1）。
 * 座標が無い場合は地図の代わりにメッセージを表示する（FR-013）。
 * Server Component として使えるが、フォームの地図プレビュー（client）からも利用する。
 */
export const ShopMap = ({ latitude, longitude, shopName }: ShopMapProps) => {
    if (latitude === null || longitude === null) {
        // bg-muted 上の text-muted-foreground はコントラスト 4.34:1 で AA 未達のため text-foreground を使う
        return (
            <p role="status" className="rounded-lg border border-border bg-muted p-4 text-foreground text-sm">
                {MAP_UNAVAILABLE_MESSAGE}
            </p>
        );
    }

    return (
        <iframe
            title={`${shopName} の地図`}
            src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`}
            loading="lazy"
            // サードパーティコンテンツの防御的サンドボックス化（地図の描画・操作に必要な権限のみ許可）
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="h-64 w-full rounded-lg border border-border"
        />
    );
};
