import Link from 'next/link';

import type { ShopListItem } from '@/features/shops/types';
import { buttonVariants } from '@/shared/components/ui/Button';

interface ShopListProps {
    shops: ShopListItem[];
}

/** ショップ一覧（FR-003）。0 件時は登録導線付きの空状態を表示する */
export const ShopList = ({ shops }: ShopListProps) => {
    if (shops.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-background p-8 text-center">
                <p className="text-muted-foreground">
                    ショップがまだ登録されていません。行きつけのショップを登録して、予定・ログ・申し込みシートと紐付けましょう。
                </p>
                <Link href="/shops/new" className={buttonVariants({ variant: 'default' })}>
                    ショップを登録
                </Link>
            </div>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {shops.map((shop) => (
                <li key={shop.id}>
                    <Link
                        href={`/shops/${shop.id}`}
                        className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/50"
                    >
                        <span className="font-bold">{shop.name}</span>
                        {shop.address && <span className="text-muted-foreground text-sm">{shop.address}</span>}
                        {shop.phone && <span className="text-muted-foreground text-sm">{shop.phone}</span>}
                    </Link>
                </li>
            ))}
        </ul>
    );
};
