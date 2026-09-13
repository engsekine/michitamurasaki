import type { Route } from 'next';
import Link from 'next/link';

import type { PublicProfile as PublicProfileData, TimelineItem } from '@/features/social/types';
import { SnsShareButtons } from '@/shared/components/social/SnsShareButtons';
import { Heading } from '@/shared/components/typography/Heading';
import { SITE_NAME, SITE_URL } from '@/shared/constants/site';
import { formatJstDate } from '@/shared/lib/date';
import { profilePath } from '@/shared/lib/profile-path';

import { FollowButton } from '../../client/FollowButton';
import { FollowCounts } from '../FollowCounts';

interface PublicProfileProps {
    profile: PublicProfileData;
    /** 対象ユーザーの公開ログ（spec 021 FR-015） */
    publicDives: TimelineItem[];
    /** 閲覧者自身のプロフィールか（自分はフォローボタン非表示） */
    isSelf: boolean;
}

/** 公開プロフィール（spec 021 US3）。表示名・フォロー UI・件数・公開ログ一覧を表示する。 */
export const PublicProfile = ({ profile, publicDives, isSelf }: PublicProfileProps) => (
    <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <Heading level={1}>{profile.nickname}</Heading>
                {!isSelf && (
                    <FollowButton targetUserId={profile.userId} initialIsFollowing={profile.followState.isFollowing} />
                )}
            </div>
            <FollowCounts
                userId={profile.userId}
                handle={profile.handle}
                followingCount={profile.followState.followingCount}
                followerCount={profile.followState.followerCount}
            />
        </header>

        {/* プロフィールの SNS 共有（spec 035 FR-002）。自分・他人とも表示する。URL は canonical な handle ベース */}
        <section aria-labelledby="public-profile-share" className="flex flex-col gap-2">
            <h2 id="public-profile-share" className="font-medium text-sm">
                SNSで共有
            </h2>
            <SnsShareButtons
                url={`${SITE_URL}${profilePath({ userId: profile.userId, handle: profile.handle })}`}
                text={`${profile.nickname}のダイビングプロフィール | ${SITE_NAME}`}
            />
        </section>

        <section aria-labelledby="public-profile-dives" className="flex flex-col gap-3">
            <h2 id="public-profile-dives" className="font-semibold text-lg">
                公開ログ
            </h2>
            {publicDives.length === 0 ? (
                <p className="text-muted-foreground text-sm">公開されたログはありません。</p>
            ) : (
                <ul className="flex flex-col divide-y divide-border">
                    {publicDives.map((dive) => (
                        <li key={dive.diveId} className="py-3">
                            <Link
                                href={`/dives/${dive.diveId}` as Route}
                                className="flex items-baseline justify-between gap-3 hover:underline"
                            >
                                <span className="font-medium text-sm">{dive.location}</span>
                                <span className="text-muted-foreground text-sm">{formatJstDate(dive.diveDate)}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    </div>
);
