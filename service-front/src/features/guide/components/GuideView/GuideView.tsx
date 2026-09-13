import Link from 'next/link';
import type { ReactNode } from 'react';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';

import { GUIDE_SECTIONS, PAGE_DATA } from '../../constants';
import { GuideSectionCard } from '../GuideSectionCard';

interface GuideViewProps {
    /** セクション id → 例示表示（表示専用の実 UI）。feature 間 import 禁止のため app 層から注入する */
    examples?: Partial<Record<string, ReactNode>>;
}

/**
 * 使い方ページの本体（030-usage-guide）。
 * GUIDE_SECTIONS を単一の情報源としてセクションを描画する。
 */
export const GuideView = ({ examples }: GuideViewProps) => {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-4 py-16">
            <div className="flex flex-col gap-2">
                <Heading level={1}>使い方</Heading>
                <p className="text-muted-foreground">{PAGE_DATA.description}</p>
            </div>
            {/* 目次（FR-003）。アンカーのみで JS 不要（research.md Decision 3） */}
            <nav aria-label="目次" id="guide-toc" className="rounded-xl border border-border bg-background p-5">
                <ol className="flex flex-col gap-2">
                    {GUIDE_SECTIONS.map((section) => (
                        <li key={section.id}>
                            <a
                                href={`#${section.id}`}
                                className="text-[#1a73cc] text-sm underline-offset-4 hover:underline"
                            >
                                {section.title}
                            </a>
                        </li>
                    ))}
                </ol>
            </nav>
            {GUIDE_SECTIONS.map((section) => (
                <div key={section.id} className="flex flex-col gap-4">
                    <GuideSectionCard section={section} example={examples?.[section.id]} />
                    <a
                        href="#guide-toc"
                        className="self-end text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
                    >
                        目次に戻る
                    </a>
                </div>
            ))}
            {/* 未登録閲覧者向けの登録導線（FR-005）。ログイン済みなら認証ガードが /dives へ誘導する */}
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 p-8 text-center">
                <p className="font-semibold text-foreground">
                    アカウントを作成して、次のダイビングから記録を始めましょう
                </p>
                <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
                    無料で始める
                </Link>
            </div>
        </div>
    );
};
