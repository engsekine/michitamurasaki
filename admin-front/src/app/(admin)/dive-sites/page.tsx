import { buttonVariants } from '@repo/ui/components/button';
import Link from 'next/link';

import {
    DIVE_SITE_SORTABLE_COLUMNS,
    type DiveSiteListRow,
    DiveSiteRowActions,
    listDiveSites,
} from '@/features/dive-sites-admin';
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
    slug: '/dive-sites',
    title: 'ダイブサイト',
    description: 'ダイブサイト（マスタ）の一覧',
});

export default async function DiveSitesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
    const sp = await searchParams;
    const page = parsePage(firstParam(sp, 'page'));
    const search = parseSearch(firstParam(sp, 'search'));
    const sort = parseSort(firstParam(sp, 'sort'), firstParam(sp, 'dir'), DIVE_SITE_SORTABLE_COLUMNS);

    const { rows, total, perPage } = await listDiveSites({ page, perPage: DEFAULT_PER_PAGE, search, sort });

    const columns: Column<DiveSiteListRow>[] = [
        { key: 'name', header: '名称', cell: (row) => row.name },
        { key: 'area', header: 'エリア', cell: (row) => row.area ?? '-' },
        { key: 'country', header: '国', cell: (row) => row.country },
        { key: 'created_at', header: '登録日', cell: (row) => new Date(row.created_at).toLocaleDateString('ja-JP') },
        {
            key: 'actions',
            header: '操作',
            cell: (row) => <DiveSiteRowActions id={row.id} name={row.name} />,
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="font-semibold text-2xl">ダイブサイト</h1>
                <Link href="/dive-sites/new" className={buttonVariants()}>
                    新規作成
                </Link>
            </div>
            <TableSearchBar placeholder="名称・エリアで検索" />
            <DataTable
                caption="ダイブサイト一覧"
                columns={columns}
                rows={rows}
                getRowKey={(row) => row.id}
                emptyMessage="ダイブサイトがありません"
            />
            <Pagination page={page} perPage={perPage} total={total} />
        </div>
    );
}
