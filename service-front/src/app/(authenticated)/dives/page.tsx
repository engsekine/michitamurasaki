import Link from 'next/link';
import { CreditBalanceBadge } from '@/features/credits/components/server/CreditBalanceBadge';
import { DiveList, ExportMenu, listDives } from '@/features/dives';
import { parseDiveFilter, recordToSearchParams } from '@/features/dives/lib/search-params';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/dives',
        title: 'ダイビングログ',
        description: 'あなたのダイビングログ一覧',
    },
    { noIndex: true },
);

interface DivesPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DivesPage({ searchParams }: DivesPageProps) {
    const filter = parseDiveFilter(recordToSearchParams(await searchParams));
    const initialPage = await listDives({ filter });

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: 'ダイビングログ' }]} />
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
                <div className="flex items-center justify-between">
                    <Heading level={1}>ダイビングログ</Heading>
                    <div className="flex items-center gap-2">
                        <CreditBalanceBadge />
                        <ExportMenu />
                        <Link href="/dives/new" className={buttonVariants({ variant: 'default' })}>
                            新規作成
                        </Link>
                    </div>
                </div>
                <DiveList initialPage={initialPage} initialFilter={filter} />
            </div>
        </div>
    );
}
