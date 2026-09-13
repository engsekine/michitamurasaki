import Link from 'next/link';

import { getShops, ShopList } from '@/features/shops';
import { PAGE_DATA } from '@/features/shops/constants';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(PAGE_DATA, { noIndex: true });

export default async function ShopsPage() {
    const shops = await getShops();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: 'ショップ' }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <div className="flex items-center justify-between">
                    <Heading level={1}>ショップ</Heading>
                    <Link href="/shops/new" className={buttonVariants({ variant: 'default' })}>
                        ショップを登録
                    </Link>
                </div>
                <ShopList shops={shops} />
            </div>
        </div>
    );
}
