import { notFound } from 'next/navigation';

import { DeleteInquiryButton, getInquiryDetail, inquiryCategoryLabel } from '@/features/inquiries-admin';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata({
    slug: '/inquiries',
    title: 'お問い合わせ詳細',
    description: 'お問い合わせの詳細',
});

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const inquiry = await getInquiryDetail(id);
    if (!inquiry) notFound();

    // submitter_ip は inet（生成型は unknown）のため文字列化して表示する
    const ip = inquiry.submitter_ip == null ? '—' : String(inquiry.submitter_ip);

    const rows: { label: string; value: string }[] = [
        { label: '受付日時', value: new Date(inquiry.created_at).toLocaleString('ja-JP') },
        { label: '氏名', value: inquiry.name },
        { label: 'メールアドレス', value: inquiry.email },
        { label: '種別', value: inquiryCategoryLabel(inquiry.category) },
        { label: '送信者', value: inquiry.submitter_user_id ?? '未ログイン' },
        { label: '送信元 IP', value: ip },
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
                <h1 className="font-semibold text-2xl">お問い合わせ詳細</h1>
                <DeleteInquiryButton id={inquiry.id} />
            </div>

            <dl className="grid max-w-2xl grid-cols-[10rem_1fr] gap-y-2 text-sm">
                {rows.map((row) => (
                    <div key={row.label} className="contents">
                        <dt className="font-medium text-muted-foreground">{row.label}</dt>
                        <dd>{row.value}</dd>
                    </div>
                ))}
            </dl>

            <section className="flex max-w-2xl flex-col gap-2">
                <h2 className="font-medium text-muted-foreground text-sm">お問い合わせ内容</h2>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm">
                    {inquiry.body}
                </p>
            </section>
        </div>
    );
}
