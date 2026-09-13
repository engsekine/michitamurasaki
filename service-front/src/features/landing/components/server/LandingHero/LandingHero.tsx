import { buttonVariants } from '@repo/ui/components/button';
import Link from 'next/link';

import { HERO_COPY } from '@/features/landing/constants';
import { cn } from '@/lib/utils';

/**
 * LP のファーストビュー（031 / FR-003）。
 * サービスのキャッチコピー・説明と、新規登録への主要 CTA・ログイン導線を置く。
 * ページ内で唯一の h1 を持つ。CTA はタッチターゲット 44px 以上を確保する（FR-010）。
 */
export const LandingHero = () => {
    return (
        <section
            aria-labelledby="landing-hero-title"
            className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24"
        >
            <h1 id="landing-hero-title" className="font-bold text-3xl text-foreground tracking-tight sm:text-5xl">
                {HERO_COPY.title}
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{HERO_COPY.description}</p>
            <div className="flex flex-col items-center gap-3">
                <Link href="/signup" className={cn(buttonVariants({ variant: 'default' }), 'h-12 px-8 text-base')}>
                    {HERO_COPY.primaryCtaLabel}
                </Link>
                <Link href="/login" className="text-primary text-sm underline underline-offset-4">
                    {HERO_COPY.loginLabel}
                </Link>
            </div>
        </section>
    );
};
