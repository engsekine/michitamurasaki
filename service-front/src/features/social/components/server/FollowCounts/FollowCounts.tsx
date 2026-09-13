import type { Route } from 'next';
import Link from 'next/link';

import { profilePath } from '@/shared/lib/profile-path';

interface FollowCountsProps {
    userId: string;
    /** ユーザー ID（034。プロフィール URL 生成用） */
    handle?: string | null;
    followingCount: number;
    followerCount: number;
}

/** フォロー中 / フォロワーの件数（spec 021 FR-016）。各一覧ページへのリンクを兼ねる。 */
export const FollowCounts = ({ userId, handle, followingCount, followerCount }: FollowCountsProps) => {
    const basePath = profilePath({ userId, handle });
    return (
        <ul className="flex gap-4 text-sm">
            <li>
                <Link href={`${basePath}/following` as Route} className="hover:underline">
                    <strong>{followingCount}</strong> フォロー中
                </Link>
            </li>
            <li>
                <Link href={`${basePath}/followers` as Route} className="hover:underline">
                    <strong>{followerCount}</strong> フォロワー
                </Link>
            </li>
        </ul>
    );
};
