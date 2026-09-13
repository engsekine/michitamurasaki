import type { Route } from 'next';
import Link from 'next/link';
import type { FollowUser } from '@/features/social/types';
import { profilePath } from '@/shared/lib/profile-path';

import { FollowButton } from '../../client/FollowButton';

interface FollowListProps {
    items: FollowUser[];
    /** 閲覧者自身の user_id。自分の行にはフォローボタンを出さない */
    currentUserId?: string | undefined;
    /** 0 件時のメッセージ */
    emptyMessage?: string;
}

/** フォロー / フォロワーのユーザー一覧（spec 021 FR-016）。各行から個人プロフィールへ遷移できる。 */
export const FollowList = ({ items, currentUserId, emptyMessage = 'ユーザーがいません' }: FollowListProps) => {
    if (items.length === 0) {
        return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
    }

    return (
        <ul className="flex flex-col divide-y divide-border">
            {items.map((user) => (
                <li key={user.userId} className="flex items-center justify-between gap-3 py-3">
                    <Link
                        href={profilePath({ userId: user.userId, handle: user.handle }) as Route}
                        className="flex flex-col hover:underline"
                    >
                        <span className="font-medium text-sm">{user.nickname}</span>
                        {user.handle && <span className="text-muted-foreground text-xs">@{user.handle}</span>}
                    </Link>
                    {user.userId !== currentUserId && (
                        <FollowButton targetUserId={user.userId} initialIsFollowing={user.isFollowing} />
                    )}
                </li>
            ))}
        </ul>
    );
};
