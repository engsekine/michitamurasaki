import { ShopForm } from '@/features/shops';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/shops/new',
        title: 'ショップの登録',
        description: '新しいダイビングショップを登録します',
    },
    { noIndex: true },
);

export default function NewShopPage() {
    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: 'ショップ', slug: '/shops' }, { name: '登録' }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>ショップの登録</Heading>
                <ShopForm />
            </div>
        </div>
    );
}
