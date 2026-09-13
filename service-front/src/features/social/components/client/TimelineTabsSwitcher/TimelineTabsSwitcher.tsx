'use client';

import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';

type TabKey = 'timeline' | 'likes';

interface TimelineTabsSwitcherProps {
    /** 「タイムライン」タブの内容（Server Component を注入） */
    timelinePanel: ReactNode;
    /** 「いいねしたログ」タブの内容（Server Component を注入） */
    likesPanel: ReactNode;
}

const TABS = [
    { key: 'timeline', label: 'タイムライン' },
    { key: 'likes', label: 'いいねしたログ' },
] as const satisfies ReadonlyArray<{ key: TabKey; label: string }>;

/**
 * TOP の「タイムライン / いいねしたログ」を遷移なしで切り替えるタブ（WAI-ARIA Tabs パターン）。
 * 内容はページ側（Server）で用意して panel として注入する（feature 間の依存を持ち込まない）。
 * 左右矢印キーでのタブ移動に対応する（accessibility.md / APG）。
 */
export const TimelineTabsSwitcher = ({ timelinePanel, likesPanel }: TimelineTabsSwitcherProps) => {
    const [active, setActive] = useState<TabKey>('timeline');
    const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({ timeline: null, likes: null });

    /** 矢印キーでフォーカス + 選択タブを移動する */
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const currentIndex = TABS.findIndex((tab) => tab.key === active);
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextTab = TABS[(currentIndex + delta + TABS.length) % TABS.length];
        if (!nextTab) return;
        setActive(nextTab.key);
        tabRefs.current[nextTab.key]?.focus();
    };

    return (
        <div className="flex flex-col gap-5">
            <div role="tablist" aria-label="閲覧の切り替え" className="flex items-center gap-1 border-border border-b">
                {TABS.map((tab) => {
                    const isActive = active === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            id={`timeline-tab-${tab.key}`}
                            aria-selected={isActive}
                            aria-controls={`timeline-panel-${tab.key}`}
                            tabIndex={isActive ? 0 : -1}
                            ref={(node) => {
                                tabRefs.current[tab.key] = node;
                            }}
                            onClick={() => setActive(tab.key)}
                            onKeyDown={handleKeyDown}
                            className={
                                isActive
                                    ? '-mb-px inline-flex min-h-11 items-center border-primary border-b-2 px-3 font-medium text-foreground text-sm'
                                    : '-mb-px inline-flex min-h-11 items-center border-transparent border-b-2 px-3 text-muted-foreground text-sm transition-colors hover:text-foreground'
                            }
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
            <div
                role="tabpanel"
                id="timeline-panel-timeline"
                aria-labelledby="timeline-tab-timeline"
                hidden={active !== 'timeline'}
            >
                {timelinePanel}
            </div>
            <div
                role="tabpanel"
                id="timeline-panel-likes"
                aria-labelledby="timeline-tab-likes"
                hidden={active !== 'likes'}
            >
                {likesPanel}
            </div>
        </div>
    );
};
