'use client';

import { useState, useTransition } from 'react';
import { followUser, unfollowUser } from '@/features/social/server/actions';
import { Button } from '@/shared/components/ui/Button';

interface FollowButtonProps {
    targetUserId: string;
    initialIsFollowing: boolean;
}

/**
 * フォロー/フォロー解除トグル（spec 021 FR-012/013）。
 * aria-pressed で状態を伝え、操作中は無効化。失敗時は role="alert" で通知する。
 */
export const FollowButton = ({ targetUserId, initialIsFollowing }: FollowButtonProps) => {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        setError(null);
        startTransition(async () => {
            const result = isFollowing ? await unfollowUser(targetUserId) : await followUser(targetUserId);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setIsFollowing(result.isFollowing);
        });
    };

    return (
        <div className="flex flex-col gap-1">
            <Button
                type="button"
                variant={isFollowing ? 'outline' : 'default'}
                onClick={handleClick}
                disabled={isPending}
                aria-pressed={isFollowing}
                aria-busy={isPending}
            >
                {isFollowing ? 'フォロー中' : 'フォロー'}
            </Button>
            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {error}
                </p>
            )}
        </div>
    );
};
