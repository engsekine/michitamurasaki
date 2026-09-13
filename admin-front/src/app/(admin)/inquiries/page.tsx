import Link from 'next/link';

import {
    INQUIRY_SORTABLE_COLUMNS,
    type InquiryListRow,
    inquiryCategoryLabel,
    listInquiries,
} from '@/features/inquiries-admin';
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
    slug: '/inquiries',
    title: 'お問い合わせ',
    description: '届いたお問い合わせの一覧',
});

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
    const sp = await searchParams;
    const page = parsePage(firstParam(sp, 'page'));
    const search = parseSearch(firstParam(sp, 'search'));
    const sort = parseSort(firstParam(sp, 'sort'), firstParam(sp, 'dir'), INQUIRY_SORTABLE_COLUMNS);

    const { rows, total, perPage } = await listInquiries({ page, perPage: DEFAULT_PER_PAGE, search, sort });

    const columns: Column<InquiryListRow>[] = [
        {
            key: 'created_at',
            header: '受付日時',
            cell: (row) => (
                <Link href={`/inquiries/${row.id}`} className="text-primary underline hover:no-underline">
                    {new Date(row.created_at).toLocaleString('ja-JP')}
                </Link>
            ),
        },
        { key: 'name', header: '氏名', cell: (row) => row.name },
        { key: 'email', header: 'メールアドレス', cell: (row) => row.email },
        { key: 'category', header: '種別', cell: (row) => inquiryCategoryLabel(row.category) },
    ];

    return (
        <div className="flex flex-col gap-4">
            <h1 className="font-semibold text-2xl">お問い合わせ</h1>
            <TableSearchBar placeholder="氏名・メールアドレスで検索" />
            <DataTable
                caption="お問い合わせ一覧"
                columns={columns}
                rows={rows}
                getRowKey={(row) => row.id}
                emptyMessage="お問い合わせはありません"
            />
            <Pagination page={page} perPage={perPage} total={total} />
        </div>
    );
}
