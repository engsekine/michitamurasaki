import { buttonVariants } from '@repo/ui/components/button';
import Link from 'next/link';

import { CTA_COPY } from '@/features/landing/constants';
import { cn } from '@/lib/utils';

/**
 * ページ最下部の CTA セクション（031 / FR-006）。
 * スクロールしきった訪問者を離脱させず、新規登録へ誘導する。
 * CTA はタッチターゲット 44px 以上を確保する（FR-010）。
 */
export const LandingCta = () => {
    return (
        <section
            aria-labelledby="landing-cta-title"
            className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-20 text-center"
        >
            <h2 id="landing-cta-title" className="font-bold text-2xl text-foreground tracking-tight sm:text-3xl">
                {CTA_COPY.title}
            </h2>
            <p className="max-w-2xl text-muted-foreground text-sm sm:text-base">{CTA_COPY.description}</p>
            <Link href="/signup" className={cn(buttonVariants({ variant: 'default' }), 'h-12 px-8 text-base')}>
                {CTA_COPY.primaryCtaLabel}
            </Link>
        </section>
    );
};
