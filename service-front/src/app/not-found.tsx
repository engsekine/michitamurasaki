import Link from 'next/link';

import { buttonVariants } from '@/shared/components/ui/Button';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/404',
        title: 'ページが見つかりません',
        description: 'お探しのページは存在しないか、移動した可能性があります。',
    },
    { noIndex: true },
);

export default function NotFound() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
            <h1 className="font-bold text-6xl text-foreground">404</h1>
            <p className="text-lg text-muted-foreground">お探しのページが見つかりませんでした</p>
            <Link href="/" className={buttonVariants({ variant: 'default', size: 'lg' })}>
                ホームに戻る
            </Link>
        </main>
    );
}
