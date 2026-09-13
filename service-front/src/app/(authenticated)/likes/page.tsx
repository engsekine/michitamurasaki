import { LikedDivesList } from '@/features/social/components/client/LikedDivesList';
import { TimelineTabs } from '@/features/social/components/server/TimelineTabs';
import { fetchLikedDives } from '@/features/social/server/queries';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/likes',
        title: 'いいねしたログ',
        description: 'あなたがいいねしたダイビングログの一覧です',
    },
    { noIndex: true },
);

/**
 * いいねしたログ一覧ページ（spec 027 US2 / FR-007〜009）。
 * 導線はホームのタブ切り替えとヘッダーナビの 2 箇所（FR-008a）。
 * 最初の 20 件を Server で取得し、追加ページは Client の LikedDivesList が読み込む。
 */
export default async function LikesPage() {
    const page = await fetchLikedDives();

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
            <Heading level={1}>いいねしたログ</Heading>
            <TimelineTabs active="likes" />
            <LikedDivesList initialItems={page.items} initialCursor={page.nextCursor} />
        </div>
    );
}
