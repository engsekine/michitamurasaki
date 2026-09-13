import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DeleteShopButton, getLinkedRecords, getShop, ShopLinkedRecords, ShopMap } from '@/features/shops';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/shops',
        title: 'ショップ詳細',
        description: '登録したダイビングショップの詳細情報',
    },
    { noIndex: true },
);

export default async function ShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const shop = await getShop(id);
    if (!shop) notFound();

    const { plans, dives } = await getLinkedRecords(id);

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: 'ショップ', slug: '/shops' }, { name: shop.name }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <div className="flex items-center justify-between gap-4">
                    <Heading level={1}>{shop.name}</Heading>
                    <div className="flex shrink-0 items-center gap-2">
                        <Link href={`/shops/${shop.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
                            編集
                        </Link>
                        <DeleteShopButton shopId={shop.id} />
                    </div>
                </div>

                <dl className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4">
                    <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground text-sm">住所</dt>
                        <dd>{shop.address || '未登録'}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground text-sm">電話番号</dt>
                        <dd>
                            {shop.phone ? (
                                <a href={`tel:${shop.phone}`} className="text-primary underline">
                                    {shop.phone}
                                </a>
                            ) : (
                                '未登録'
                            )}
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground text-sm">Web サイト</dt>
                        <dd>
                            {shop.websiteUrl ? (
                                <a
                                    href={shop.websiteUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="break-all text-primary underline"
                                >
                                    {shop.websiteUrl}
                                </a>
                            ) : (
                                '未登録'
                            )}
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground text-sm">メモ</dt>
                        <dd className="whitespace-pre-wrap">{shop.memo || '未登録'}</dd>
                    </div>
                </dl>

                {/* 保存済み座標で地図を表示（FR-012）。住所未入力は領域ごと非表示、住所ありで座標なしはメッセージ（FR-013 / US3-3・4） */}
                {shop.address && <ShopMap latitude={shop.latitude} longitude={shop.longitude} shopName={shop.name} />}

                {/* 紐付いた予定・ログの逆引き一覧（FR-016） */}
                <ShopLinkedRecords plans={plans} dives={dives} />
            </div>
        </div>
    );
}
