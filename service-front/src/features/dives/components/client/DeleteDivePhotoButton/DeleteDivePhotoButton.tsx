'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteDivePhoto } from '@/features/dives/server/photoActions';
import { Button } from '@/shared/components/ui/Button';

interface DeleteDivePhotoButtonProps {
    photoId: string;
}

/**
 * 写真 1 枚を削除するボタン（FR-013）。
 * 1 回目のクリックでインライン確認を表示し、確定で `deleteDivePhoto` を実行する。
 * 成功後は router.refresh() で詳細ページを再取得（削除された写真はギャラリーから消える）。
 */
export const DeleteDivePhotoButton = ({ photoId }: DeleteDivePhotoButtonProps) => {
    const router = useRouter();
    const [isConfirming, setIsConfirming] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleDelete = () => {
        setError(null);
        startTransition(async () => {
            const result = await deleteDivePhoto(photoId);
            if (!result.success) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    if (!isConfirming) {
        return (
            <Button type="button" variant="destructive" size="sm" onClick={() => setIsConfirming(true)}>
                写真を削除
            </Button>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">この写真を削除しますか？元に戻せません。</p>
            {error && (
                <p role="alert" className="text-red-600 text-sm">
                    {error}
                </p>
            )}
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsConfirming(false)}
                    disabled={isPending}
                >
                    キャンセル
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isPending}
                    aria-busy={isPending}
                >
                    {isPending ? '削除中...' : '削除する'}
                </Button>
            </div>
        </div>
    );
};
