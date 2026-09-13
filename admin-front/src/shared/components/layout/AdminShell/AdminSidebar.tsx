'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

/**
 * 管理画面の左サイドバーナビゲーション。
 * 現在地を aria-current="page" で示す（WCAG 2.1 AA / FR-019）。
 */
const NAV_ITEMS = [
    { href: '/', label: 'ダッシュボード' },
    { href: '/users', label: 'ユーザー' },
    { href: '/dives', label: 'ダイブログ' },
    { href: '/dive-sites', label: 'ダイブサイト' },
    { href: '/inquiries', label: 'お問い合わせ' },
    { href: '/audit-logs', label: '操作ログ' },
] as const;

/** 汎用テーブルエディタの対象（許可リスト） */
const TABLE_ITEMS = [
    { href: '/tables/user_details', label: 'ユーザー詳細' },
    { href: '/tables/certifications', label: '資格' },
    { href: '/tables/dive_plans', label: 'ダイブプラン' },
    { href: '/tables/regulators', label: 'レギュレータ' },
] as const;

export const AdminSidebar = () => {
    const pathname = usePathname();

    const renderLink = (item: { href: string; label: string }) => {
        const isCurrent = pathname === item.href;
        return (
            <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                    'rounded-md px-3 py-2 font-medium text-sm transition-colors',
                    isCurrent ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
            >
                {item.label}
            </Link>
        );
    };

    return (
        <nav aria-label="メインナビゲーション" className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map(renderLink)}
            <p className="px-3 pt-4 pb-1 font-medium text-muted-foreground text-xs">テーブルエディタ</p>
            {TABLE_ITEMS.map(renderLink)}
        </nav>
    );
};
