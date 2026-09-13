import type { Route } from 'next';
import Link from 'next/link';

interface TimelineTabsProps {
    /** 現在表示中のページ（タブの aria-current に反映） */
    active: 'timeline' | 'likes';
}

const TABS = [
    { key: 'timeline', href: '/', label: 'タイムライン' },
    { key: 'likes', href: '/likes', label: 'いいねしたログ' },
] as const;

/**
 * 「タイムライン / いいねしたログ」の切り替え導線（spec 027 FR-008a）。
 * クライアント状態を持たないリンクタブ（ページ遷移で切り替わる Server Component）。
 * 現在地は aria-current="page" + 下線・色の両方で示す（色だけに依存しない）。
 */
export const TimelineTabs = ({ active }: TimelineTabsProps) => (
    <nav aria-label="閲覧の切り替え">
        <ul className="flex items-center gap-1 border-border border-b">
            {TABS.map((tab) => (
                <li key={tab.key}>
                    <Link
                        href={tab.href as Route}
                        aria-current={active === tab.key ? 'page' : undefined}
                        className={
                            active === tab.key
                                ? '-mb-px inline-flex min-h-11 items-center border-primary border-b-2 px-3 font-medium text-foreground text-sm'
                                : '-mb-px inline-flex min-h-11 items-center border-transparent border-b-2 px-3 text-muted-foreground text-sm transition-colors hover:text-foreground'
                        }
                    >
                        {tab.label}
                    </Link>
                </li>
            ))}
        </ul>
    </nav>
);
