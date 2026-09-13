import { Geist, Geist_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import Script from 'next/script';

import { AuthNav } from '@/features/auth';
import { COOKIE_CONSENT_NAME, CookieConsentBanner, getCookieConsentServer } from '@/features/consent';
import { NotificationBell } from '@/features/notifications';
import { Footer } from '@/shared/components/layout/Footer';
import { Header } from '@/shared/components/layout/Header';
import { ThemeToggle } from '@/shared/components/theme/ThemeToggle';
import { SITE_METADATA } from '@/shared/config/metadata';
import { createClient } from '@/shared/lib/supabase/server';

import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata = SITE_METADATA;

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // 同意状態はサーバーで判定し、未選択のときだけバナーを描画してちらつきを防ぐ（FR-011）
    const cookieStore = await cookies();
    const consent = getCookieConsentServer(cookieStore.get(COOKIE_CONSENT_NAME)?.value);

    return (
        <html
            lang="ja"
            suppressHydrationWarning
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="flex min-h-full flex-col">
                <Script id="theme-init" strategy="beforeInteractive">
                    {`(function () {
                        try {
                            var saved = localStorage.getItem('theme');
                            var prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
                            if (saved === 'dark' || (!saved && prefersDark)) document.documentElement.classList.add('dark');
                        } catch (e) {}
                    })();`}
                </Script>
                <Providers>
                    <Header
                        actions={
                            <>
                                <ThemeToggle />
                                {user && <NotificationBell />}
                                <AuthNav initialUser={user} />
                            </>
                        }
                    />
                    <main className="bg-background">{children}</main>
                    <Footer />
                    <CookieConsentBanner initialConsent={consent} />
                </Providers>
            </body>
        </html>
    );
}
