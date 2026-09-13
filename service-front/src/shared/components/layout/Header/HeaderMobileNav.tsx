'use client';

import { Menu } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/Sheet';

interface HeaderMobileNavProps {
    /** ハンバーガーメニューに表示するナビゲーション項目 */
    items: ReadonlyArray<{ href: Route; label: string }>;
}

/**
 * SP 用ハンバーガーメニュー。テキストナビゲーションをシートに収める。
 * md 以上ではデスクトップナビが表示されるためトリガーごと非表示にする。
 */
export const HeaderMobileNav = ({ items }: HeaderMobileNavProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger
                render={<Button variant="ghost" size="icon" aria-label="メニューを開く" className="md:hidden" />}
            >
                <Menu />
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>メニュー</SheetTitle>
                </SheetHeader>
                <nav aria-label="メインナビゲーション" className="flex flex-col gap-2 p-4">
                    {items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className="rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
    );
};
