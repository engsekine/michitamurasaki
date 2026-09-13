'use client';

import { Heart } from 'lucide-react';
import { useState, useTransition } from 'react';

import { likeDive, unlikeDive } from '@/features/social/server/actions';

interface LikeButtonProps {
    diveId: string;
    initialIsLiked: boolean;
    initialCount: number;
}

/**
 * 公開ログへのいいねトグル（spec 027 US1）。
 * 楽観的 UI（即時反映 + 失敗時ロールバック / SC-001）。FollowButton と同型。
 * 状態は aria-pressed + アイコンの塗り（色だけに依存しない）で伝える。
 */
export const LikeButton = ({ diveId, initialIsLiked, initialCount }: LikeButtonProps) => {
    const [isLiked, setIsLiked] = useState(initialIsLiked);
    const [count, setCount] = useState(initialCount);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        if (isPending) return;
        setError(null);

        // 楽観的更新（失敗時はロールバック）
        const previous = { isLiked, count };
        const next = isLiked ? { isLiked: false, count: Math.max(0, count - 1) } : { isLiked: true, count: count + 1 };
        setIsLiked(next.isLiked);
        setCount(next.count);

        startTransition(async () => {
            const result = previous.isLiked ? await unlikeDive(diveId) : await likeDive(diveId);
            if (!result.success) {
                setIsLiked(previous.isLiked);
                setCount(previous.count);
                setError(result.error);
                return;
            }
            setIsLiked(result.isLiked);
        });
    };

    return (
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={handleClick}
                aria-pressed={isLiked}
                aria-busy={isPending}
                aria-label={`いいね ${count} 件${isLiked ? '、いいね済み' : ''}`}
                className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
            >
                <Heart aria-hidden="true" className={isLiked ? 'size-5 fill-rose-500 text-rose-500' : 'size-5'} />
                <span>{count}</span>
            </button>
            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {error}
                </p>
            )}
        </div>
    );
};
