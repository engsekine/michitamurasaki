import { FollowList, searchUsers, UserSearchBar } from '@/features/social';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';
import { createClient } from '@/shared/lib/supabase/server';

interface UserSearchPageProps {
    searchParams: Promise<{ q?: string }>;
}

export const generateMetadata = () =>
    generatePageMetadata(
        {
            slug: '/users/search',
            title: 'ユーザーを探す',
            description: 'ユーザーIDでユーザーを検索してフォローする',
        },
        { noIndex: true },
    );

export default async function UserSearchPage({ searchParams }: UserSearchPageProps) {
    const { q = '' } = await searchParams;
    const query = q.trim();

    const results = query.length > 0 ? await searchUsers(query) : [];
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: 'ユーザーを探す' }]} />
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>ユーザーを探す</Heading>
                <UserSearchBar />

                {query.length > 0 && (
                    <section aria-labelledby="user-search-results" className="flex flex-col gap-3">
                        <h2 id="user-search-results" className="font-medium text-muted-foreground text-sm">
                            「{query}」の検索結果
                        </h2>
                        <FollowList
                            items={results}
                            currentUserId={user?.id}
                            emptyMessage="該当するユーザーが見つかりませんでした"
                        />
                    </section>
                )}
            </div>
        </div>
    );
}
