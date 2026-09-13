import { fetchUserPublicDives, PublicProfile, requireProfileBySlug } from '@/features/social';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { generatePageMetadata } from '@/shared/config/metadata';
import { profilePath } from '@/shared/lib/profile-path';
import { createClient } from '@/shared/lib/supabase/server';

interface ProfilePageProps {
    params: Promise<{ slug: string }>;
}

// slug の解決（uuid → 転送 / 不在 → notFound）は requireProfileBySlug に集約。
// cache() 済みのため generateMetadata と page 本体で二重フェッチにならない（034）
export const generateMetadata = async ({ params }: ProfilePageProps) => {
    const { slug } = await params;
    const profile = await requireProfileBySlug(slug);
    return generatePageMetadata(
        {
            // canonical はニックネーム URL を正とする（URL 不可ニックネームは ID URL のまま = FR-005）
            slug: profilePath({ userId: profile.userId, handle: profile.handle }),
            title: `${profile.nickname} さんのプロフィール`,
            description: `${profile.nickname} さんの公開ログとフォロー情報`,
        },
        { noIndex: true },
    );
};

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { slug } = await params;
    const profile = await requireProfileBySlug(slug);

    const publicDives = await fetchUserPublicDives(profile.userId);
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const isSelf = user?.id === profile.userId;

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: profile.nickname }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <PublicProfile profile={profile} publicDives={publicDives.items} isSelf={isSelf} />
            </div>
        </div>
    );
}
