import Image from 'next/image';
import Link from 'next/link';

import { CookieSettingsButton } from '@/features/consent';
import { COPYRIGHT_HOLDER, SITE_NAME } from '@/shared/constants/site';

const FOOTER_LINKS = [
    { href: '/', label: 'ホーム' },
    { href: '/dives', label: 'ダイビングログ' },
    { href: '/settings/certifications', label: '保有資格' },
    { href: '/guide', label: '使い方' },
    { href: '/terms', label: '利用規約' },
    { href: '/privacy-policy', label: 'プライバシーポリシー' },
    { href: '/contact', label: 'お問い合わせ' },
] as const;

export const Footer = () => {
    return (
        <footer className="border-border border-t bg-background">
            <div className="mx-auto max-w-5xl px-4 py-6">
                <div className="mb-4 flex justify-center">
                    <Link href="/" aria-label={SITE_NAME} className="inline-flex">
                        <Image src="/logo.png" alt={SITE_NAME} width={96} height={48} className="h-12 w-auto" />
                    </Link>
                </div>
                <nav aria-label="フッターナビゲーション">
                    <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                        {FOOTER_LINKS.map((link) => (
                            <li key={link.href}>
                                <Link href={link.href} className="text-muted-foreground text-sm hover:text-foreground">
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                        <li>
                            <CookieSettingsButton />
                        </li>
                    </ul>
                </nav>
                <p className="mt-4 text-center text-muted-foreground text-sm">
                    &copy; {new Date().getFullYear()} {COPYRIGHT_HOLDER}. All rights reserved.
                </p>
            </div>
        </footer>
    );
};
