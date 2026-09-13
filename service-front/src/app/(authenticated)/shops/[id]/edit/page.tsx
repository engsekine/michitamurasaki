import { notFound } from 'next/navigation';

import { getShop, ShopForm } from '@/features/shops';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/shops',
        title: 'ショップの編集',
        description: '登録したダイビングショップの情報を編集します',
    },
    { noIndex: true },
);

export default async function EditShopPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const shop = await getShop(id);
    if (!shop) notFound();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs
                breadcrumbs={[
                    { name: 'ショップ', slug: '/shops' },
                    { name: shop.name, slug: `/shops/${id}` },
                    { name: '編集' },
                ]}
            />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>ショップの編集</Heading>
                <ShopForm
                    shopId={shop.id}
                    defaultValues={{
                        name: shop.name,
                        address: shop.address,
                        phone: shop.phone,
                        websiteUrl: shop.websiteUrl,
                        memo: shop.memo,
                    }}
                    initialCoordinates={{ latitude: shop.latitude, longitude: shop.longitude }}
                />
            </div>
        </div>
    );
}
