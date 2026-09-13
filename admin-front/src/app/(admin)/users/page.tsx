import Link from 'next/link';

import { listUsers, USER_SORTABLE_COLUMNS, type UserListRow } from '@/features/users-admin';
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
    slug: '/users',
    title: 'ユーザー',
    description: '登録ユーザーの一覧',
});

export default async function UsersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
    const sp = await searchParams;
    const page = parsePage(firstParam(sp, 'page'));
    const search = parseSearch(firstParam(sp, 'search'));
    const sort = parseSort(firstParam(sp, 'sort'), firstParam(sp, 'dir'), USER_SORTABLE_COLUMNS);

    const { rows, total, perPage } = await listUsers({ page, perPage: DEFAULT_PER_PAGE, search, sort });

    const columns: Column<UserListRow>[] = [
        {
            key: 'nickname',
            header: 'ニックネーム',
            cell: (row) => (
                <Link href={`/users/${row.user_id}`} className="text-primary underline hover:no-underline">
                    {row.nickname}
                </Link>
            ),
        },
        { key: 'name', header: '氏名', cell: (row) => `${row.last_name} ${row.first_name}` },
        { key: 'created_at', header: '登録日', cell: (row) => new Date(row.created_at).toLocaleDateString('ja-JP') },
    ];

    return (
        <div className="flex flex-col gap-4">
            <h1 className="font-semibold text-2xl">ユーザー</h1>
            <TableSearchBar placeholder="ニックネーム・氏名で検索" />
            <DataTable
                caption="ユーザー一覧"
                columns={columns}
                rows={rows}
                getRowKey={(row) => row.user_id}
                emptyMessage="ユーザーがいません"
            />
            <Pagination page={page} perPage={perPage} total={total} />
        </div>
    );
}
