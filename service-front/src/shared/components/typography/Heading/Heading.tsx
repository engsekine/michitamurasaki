import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

type HeadingLevel = 1 | 2 | 3 | 4;

interface HeadingProps extends ComponentPropsWithoutRef<'h1'> {
    /** 見出しレベル。h1〜h4 の実タグとタイポグラフィに対応する */
    level: HeadingLevel;
}

/** レベルごとのタイポグラフィ */
const TEXT_STYLES: Record<HeadingLevel, string> = {
    1: 'font-bold text-3xl',
    2: 'font-semibold text-xl',
    3: 'font-semibold text-base',
    4: 'font-medium text-sm',
};

/** セクション見出し（h2 / h3）に添えるアクセントバーのサイズ。h1 はページタイトル、h4 は小見出しなのでバーなし */
const BAR_STYLES: Partial<Record<HeadingLevel, string>> = {
    2: 'h-5 w-1',
    3: 'h-4 w-0.5',
};

/**
 * 共通の見出しコンポーネント。ページ内の見出し（h1〜h4）は生の hN タグではなく本コンポーネントを使う
 * （見た目の統一に加え、markuplint の単独解析による heading-levels 誤検知を避けるため）。
 * レベルに応じたタイポグラフィと、セクション見出し（h2 / h3）には海をイメージしたグラデーションバーを添える。
 * 文字色は継承ベースのため、写真の上など白文字にしたい場合は className で上書きする。
 */
export const Heading = ({ level, className, children, ...props }: HeadingProps) => {
    const Tag = `h${level}` as const;
    const barStyle = BAR_STYLES[level];

    return (
        <Tag className={cn('flex items-center gap-2.5 tracking-tight', TEXT_STYLES[level], className)} {...props}>
            {barStyle && (
                <span
                    aria-hidden="true"
                    className={cn('shrink-0 rounded-full bg-linear-to-b from-sky-500 to-cyan-300', barStyle)}
                />
            )}
            {children}
        </Tag>
    );
};
