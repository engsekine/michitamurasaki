import { Heart } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { LikeButton } from '@/features/social/components/client/LikeButton';
import { groupTimelineByDate, isTimelineEmpty } from '@/features/social/lib/timeline';
import type { TimelineItem } from '@/features/social/types';
import { Heading } from '@/shared/components/typography/Heading';
import { formatJstDate } from '@/shared/lib/date';
import { profilePath } from '@/shared/lib/profile-path';

interface TimelineProps {
    items: TimelineItem[];
    /** 閲覧者のユーザー ID。自分のログにはいいね操作を出さない（spec 027 FR-006）。未指定は件数のみ表示 */
    viewerId?: string | null;
}

/**
 * TOP タイムライン（spec 021 US4）。フォロー中ユーザーの公開ログを日付ごとに表示する。
 * 空状態（フォロー 0 / 公開ログ 0）はフォローを促すメッセージを出す。
 */
export const Timeline = ({ items, viewerId = null }: TimelineProps) => {
    if (isTimelineEmpty(items)) {
        return (
            <p className="rounded-md border border-border border-dashed bg-muted/30 px-4 py-6 text-center text-muted-foreground">
                フォロー中のユーザーの公開ログがここに表示されます。気になるダイバーをフォローしてみましょう。
            </p>
        );
    }

    const groups = groupTimelineByDate(items);

    return (
        <ol className="flex flex-col gap-5">
            {groups.map((group) => (
                <li key={group.date} className="flex flex-col gap-2">
                    {/* page.tsx のタブ配下に置かれる日付グループ見出し（h3 が正しい階層）。
                        日付は控えめに出したいので Heading の既定スタイルを className で上書きする */}
                    <Heading level={3} className="font-medium text-muted-foreground">
                        {formatJstDate(group.date)}
                    </Heading>
                    <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                        {group.items.map((dive) => (
                            <li key={dive.diveId} className="flex items-center justify-between gap-2 px-4 py-3">
                                <div className="flex flex-col gap-1">
                                    <Link
                                        href={`/dives/${dive.diveId}` as Route}
                                        className="font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                                    >
                                        {dive.location}
                                    </Link>
                                    <span className="text-muted-foreground text-xs">
                                        <Link
                                            href={
                                                profilePath({
                                                    userId: dive.ownerId,
                                                    handle: dive.ownerHandle,
                                                }) as Route
                                            }
                                            className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                                        >
                                            {dive.ownerNickname}
                                        </Link>
                                        {' ・ '}最大 {dive.maxDepthM}m ・ {dive.bottomTimeMin}分
                                    </span>
                                </div>
                                {viewerId && dive.ownerId !== viewerId ? (
                                    <LikeButton
                                        diveId={dive.diveId}
                                        initialIsLiked={dive.likedByMe}
                                        initialCount={dive.likeCount}
                                    />
                                ) : (
                                    /* 自分のログ・閲覧者不明時は件数のみ（操作させない / US1-AC5） */
                                    <span className="inline-flex items-center gap-1.5 px-2 text-muted-foreground">
                                        <Heart aria-hidden="true" className="size-5" />
                                        <span aria-hidden="true">{dive.likeCount}</span>
                                        <span className="sr-only">いいね {dive.likeCount} 件</span>
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </li>
            ))}
        </ol>
    );
};
