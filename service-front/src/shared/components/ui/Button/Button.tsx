import { Button as UiButton, buttonVariants as uiButtonVariants } from '@repo/ui/components/button';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

type ButtonVariantOptions = Parameters<typeof uiButtonVariants>[0];

/**
 * ブランドカラー（塗りつぶしボタン）。@repo/ui 既定の黒系（bg-primary）を上書きし #1649B1（青）にする。
 * shadcn / @repo/ui 側は編集せず、このラッパーだけで色を持つ。default 以外の variant
 * （outline / ghost / secondary / link / destructive）は @repo/ui のスタイルをそのまま使う。
 * tailwind-merge により bg-primary → bg-[#1649b1] に後勝ちで置き換わる。
 */
const BRAND_DEFAULT_CLASS = 'bg-[#1649b1] text-white hover:bg-[#1649b1]/90';

/**
 * service-front 全体のボタンを bold + ブランド青（default）に統一する `buttonVariants` ラッパー。
 * Link に buttonVariants を渡す用途で使う。
 */
export const buttonVariants = (options?: ButtonVariantOptions): string =>
    cn(uiButtonVariants(options), 'font-bold', (options?.variant ?? 'default') === 'default' && BRAND_DEFAULT_CLASS);

/**
 * @repo/ui の Button を bold + ブランド青（default）でラップしたコンポーネント。
 * service-front では `@repo/ui/components/button` を直接使わず、このラッパーを使う。
 */
export const Button = ({ className, variant, ...props }: ComponentProps<typeof UiButton>) => (
    <UiButton
        variant={variant}
        className={cn('font-bold', (variant ?? 'default') === 'default' && BRAND_DEFAULT_CLASS, className)}
        {...props}
    />
);
