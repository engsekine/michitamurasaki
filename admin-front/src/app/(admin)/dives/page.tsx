import Link from 'next/link';

import { DIVE_SORTABLE_COLUMNS, type DiveListRow, listDives } from '@/features/dives-admin';
import { type Column, DataTable } from '@/shared/components/table/DataTable';
import { Pagination } from '@/shared/components/table/Pagination';
import { TableSearchBar } from '@/shared/components/table/TableSearchBar';
import { generatePageMetadata } from '@/shared/config/metadata';
import {
    DEFAULT_PER_PAGE,
    firstParam,
    parsePage,
    parseSearch,
    parseSort,
    type RawSearchParams,
} from '@/shared/lib/resource/params';

export const metadata = generatePageMetadata({
    slug: '/dives',
    title: 'ダイブログ',
    description: 'ダイブログの一覧',
});

export default async function DivesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
    const sp = await searchParams;
    const page = parsePage(firstParam(sp, 'page'));
    const search = parseSearch(firstParam(sp, 'search'));
    const sort = parseSort(firstParam(sp, 'sort'), firstParam(sp, 'dir'), DIVE_SORTABLE_COLUMNS);

    const { rows, total, perPage } = await listDives({ page, perPage: DEFAULT_PER_PAGE, search, sort });

    const columns: Column<DiveListRow>[] = [
        { key: 'dive_date', header: '潜水日', cell: (row) => row.dive_date },
        {
            key: 'location',
            header: 'ポイント',
            cell: (row) => (
                <Link href={`/dives/${row.id}`} className="text-primary underline hover:no-underline">
                    {row.location ?? '(サイト参照)'}
                </Link>
            ),
        },
        { key: 'max_depth_m', header: '最大水深(m)', cell: (row) => String(row.max_depth_m) },
        { key: 'created_at', header: '記録日', cell: (row) => new Date(row.created_at).toLocaleDateString('ja-JP') },
    ];

    return (
        <div className="flex flex-col gap-4">
            <h1 className="font-semibold text-2xl">ダイブログ</h1>
            <TableSearchBar placeholder="ポイント・バディで検索" />
            <DataTable
                caption="ダイブログ一覧"
                columns={columns}
                rows={rows}
                getRowKey={(row) => row.id}
                emptyMessage="ダイブログがありません"
            />
            <Pagination page={page} perPage={perPage} total={total} />
        </div>
    );
}
