import Image from 'next/image';

import { LANDING_FEATURES } from '@/features/landing/constants';

/**
 * 主要機能の紹介セクション（031 / FR-004・FR-004a）。
 * constants の 4 機能を、実際のサービス画面イメージ（スクリーンショット）付きで並べる。
 * 画像はファーストビュー外のため遅延読み込み（next/image の既定）。
 * 奇数・偶数で画像とテキストの左右を入れ替え、単調さを避ける（見た目のみ）。
 */
export const LandingFeatures = () => {
    return (
        <section aria-labelledby="landing-features-title" className="mx-auto w-full max-w-5xl px-4 py-16">
            <h2
                id="landing-features-title"
                className="mb-12 text-center font-bold text-2xl text-foreground tracking-tight sm:text-3xl"
            >
                できること
            </h2>
            <ul className="flex flex-col gap-16">
                {LANDING_FEATURES.map((feature) => (
                    <li
                        key={feature.title}
                        className="flex flex-col items-center gap-6 md:flex-row md:gap-10 md:even:flex-row-reverse"
                    >
                        <div className="w-full overflow-hidden rounded-xl border border-border shadow-sm md:w-1/2">
                            <Image
                                src={feature.imageSrc}
                                alt={feature.imageAlt}
                                width={1200}
                                height={750}
                                sizes="(min-width: 768px) 50vw, 100vw"
                                className="h-auto w-full"
                            />
                        </div>
                        <div className="flex w-full flex-col gap-3 md:w-1/2">
                            <h3 className="font-semibold text-foreground text-xl">{feature.title}</h3>
                            <p className="text-muted-foreground text-sm sm:text-base">{feature.description}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};
