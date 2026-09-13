import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SITE_NAME } from '@/shared/constants/site';

import { HeaderMobileNav } from './HeaderMobileNav';

interface HeaderProps {
    actions?: ReactNode;
}

/** ナビゲーション項目。デスクトップは横並び、SP は HeaderMobileNav（ハンバーガー）に収める */
const NAV_ITEMS: ReadonlyArray<{ href: Route; label: string }> = [
    { href: '/dives', label: 'ダイビングログ' },
    { href: '/shops', label: 'ショップ' },
    { href: '/likes', label: 'いいね' },
    { href: '/guide', label: '使い方' },
];

export const Header = ({ actions }: HeaderProps) => {
    return (
        <header className="border-border border-b bg-background">
            <div className="flex h-14 items-center justify-between px-4">
                <Link href="/" aria-label={`${SITE_NAME} ホーム`}>
                    <Image src="/logo.png" alt="" width={80} height={40} priority className="h-10 w-auto" />
                </Link>
                <div className="flex items-center gap-6">
                    <nav aria-label="メインナビゲーション" className="hidden md:block">
                        <ul className="flex items-center gap-6">
                            {NAV_ITEMS.map((item) => (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                                    >
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                    <div className="flex items-center gap-2">
                        {actions}
                        <HeaderMobileNav items={NAV_ITEMS} />
                    </div>
                </div>
            </div>
        </header>
    );
};
