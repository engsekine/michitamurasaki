import Link from 'next/link';

import { getCreditBalance } from '@/features/credits/server/queries';

/**
 * ログ枠の残数バッジ（026 / FR-013）。
 * Server Component として残高を直接フェッチし、ログ導線の近傍に置く。
 * バッジ自体が購入ページ（/settings/log-credits）への導線を兼ねる。
 * 色だけに依存せずテキストで残数を判別できるようにする（a11y）
 */
interface CreditBalanceBadgeProps {
    /** hero: FV の写真背景上に置く半透明スタイル（残数 0 の警告色はどちらでも維持する） */
    variant?: 'default' | 'hero';
}

export const CreditBalanceBadge = async ({ variant = 'default' }: CreditBalanceBadgeProps = {}) => {
    const balance = await getCreditBalance();
    const isEmpty = balance === 0;

    const toneClass = isEmpty
        ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
        : variant === 'hero'
          ? 'border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20'
          : 'border-border bg-background text-foreground hover:bg-muted';

    return (
        <Link
            href="/settings/log-credits"
            aria-label={`残りログ枠 ${balance}。ログ枠の購入ページへ`}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${toneClass}`}
        >
            残りログ枠 <span className="font-semibold">{balance}</span>
        </Link>
    );
};
