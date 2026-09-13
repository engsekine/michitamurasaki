'use client';

import { Heart } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { loadMoreLikedDives } from '@/features/social/server/actions';
import type { LikedDivesCursor, TimelineItem } from '@/features/social/types';
import { Button } from '@/shared/components/ui/Button';
import { formatJstDate } from '@/shared/lib/date';
import { profilePath } from '@/shared/lib/profile-path';

interface LikedDivesListProps {
    initialItems: TimelineItem[];
    initialCursor: LikedDivesCursor | null;
}

/**
 * いいねしたログの一覧（spec 027 US2）。いいね日時の新しい順・keyset の追加読み込み付き。
 * 一覧上にいいね操作は置かない（Clarification Q2。取り消しはログ詳細から）。
 * 表示中に非公開化・削除されたログは再読み込みで消える（FR-009 / RLS 由来）。
 */
export const LikedDivesList = ({ initialItems, initialCursor }: LikedDivesListProps) => {
    const [items, setItems] = useState(initialItems);
    const [cursor, setCursor] = useState(initialCursor);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingMore, startTransition] = useTransition();

    const handleLoadMore = () => {
        if (!cursor) return;
        setError(null);
        startTransition(async () => {
            try {
                const page = await loadMoreLikedDives(cursor);
                setItems((prev) => [...prev, ...page.items]);
                setCursor(page.nextCursor);
            } catch {
                setError('読み込みに失敗しました。時間をおいて再度お試しください');
            }
        });
    };

    if (items.length === 0) {
        return (
            <p className="rounded-md border border-border border-dashed bg-muted/30 px-4 py-6 text-center text-muted-foreground">
                いいねしたログはありません。タイムラインで気になるログにいいねしてみましょう。
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                {items.map((dive) => (
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
                                    href={profilePath({ userId: dive.ownerId, handle: dive.ownerHandle }) as Route}
                                    className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                                >
                                    {dive.ownerNickname}
                                </Link>
                                {' ・ '}
                                {formatJstDate(dive.diveDate)}
                                {' ・ '}最大 {dive.maxDepthM}m ・ {dive.bottomTimeMin}分
                            </span>
                        </div>
                        {/* いいね済みの一覧なので塗りアイコン + 件数のみ（操作は詳細ページで） */}
                        <span className="inline-flex items-center gap-1.5 px-2 text-muted-foreground">
                            <Heart aria-hidden="true" className="size-5 fill-rose-500 text-rose-500" />
                            <span aria-hidden="true">{dive.likeCount}</span>
                            <span className="sr-only">いいね {dive.likeCount} 件</span>
                        </span>
                    </li>
                ))}
            </ul>
            {cursor && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    aria-busy={isLoadingMore}
                >
                    {isLoadingMore ? '読み込み中...' : 'さらに読み込む'}
                </Button>
            )}
            {error && (
                <p role="alert" className="text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
};
