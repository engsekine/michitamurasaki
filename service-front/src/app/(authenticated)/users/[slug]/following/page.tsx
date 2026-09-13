import { FollowList, fetchFollowLists, requireProfileBySlug } from '@/features/social';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';
import { profilePath } from '@/shared/lib/profile-path';
import { createClient } from '@/shared/lib/supabase/server';

interface FollowingPageProps {
    params: Promise<{ slug: string }>;
}

// slug の解決（uuid → 下層パス維持で転送 / 不在 → notFound）は requireProfileBySlug に集約（034）
export const generateMetadata = async ({ params }: FollowingPageProps) => {
    const { slug } = await params;
    const profile = await requireProfileBySlug(slug, '/following');
    return generatePageMetadata(
        {
            slug: `${profilePath({ userId: profile.userId, handle: profile.handle })}/following`,
            title: `${profile.nickname} さんのフォロー中`,
            description: 'フォロー中のユーザー一覧',
        },
        { noIndex: true },
    );
};

export default async function FollowingPage({ params }: FollowingPageProps) {
    const { slug } = await params;
    const profile = await requireProfileBySlug(slug, '/following');

    const { items } = await fetchFollowLists(profile.userId, 'following');
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs
                breadcrumbs={[
                    {
                        name: profile.nickname,
                        slug: profilePath({ userId: profile.userId, handle: profile.handle }),
                    },
                    { name: 'フォロー中' },
                ]}
            />
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
                <Heading level={1}>{profile.nickname} さんのフォロー中</Heading>
                <FollowList items={items} currentUserId={user?.id} emptyMessage="まだ誰もフォローしていません。" />
            </div>
        </div>
    );
}
