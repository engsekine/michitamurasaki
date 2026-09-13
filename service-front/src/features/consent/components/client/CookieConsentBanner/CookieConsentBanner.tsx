'use client';

import Link from 'next/link';
import { useState } from 'react';
import { type ConsentState, setCookieConsent } from '@/features/consent/lib/cookie-consent';
import { useCookieConsentStore } from '@/features/consent/lib/store';
import { Button } from '@/shared/components/ui/Button';

interface CookieConsentBannerProps {
    /** サーバーが Cookie から判定した初期同意状態（未選択は null） */
    initialConsent: ConsentState | null;
}

/**
 * 非ブロッキングの Cookie 同意バナー（017-cookie-consent）。
 * - 表示条件: 未選択（initialConsent===null かつ未決定）または フッターからの再表示（forcedOpen）
 * - モーダルにしない（背後を操作可能・フォーカストラップなし、FR-014）
 * - 操作は「同意する」「拒否する」「ポリシーリンク」のみ（閉じる✕なし、FR-015）
 */
export const CookieConsentBanner = ({ initialConsent }: CookieConsentBannerProps) => {
    const forcedOpen = useCookieConsentStore((state) => state.forcedOpen);
    const closeForced = useCookieConsentStore((state) => state.close);
    const [decided, setDecided] = useState(initialConsent !== null);

    const visible = forcedOpen || !decided;
    if (!visible) return null;

    const handleChoice = (state: ConsentState) => {
        setCookieConsent(state);
        setDecided(true);
        closeForced();
    };
    const handleAccept = () => handleChoice('accepted');
    const handleReject = () => handleChoice('rejected');

    return (
        <section
            aria-label="Cookie の利用について"
            aria-live="polite"
            className="motion-safe:slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 border-border border-t bg-background shadow-lg motion-safe:animate-in"
        >
            <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">
                    当サイトはログイン等の必要な機能のために Cookie を使用します。詳しくは
                    <Link href="/privacy-policy" className="underline hover:text-foreground">
                        プライバシーポリシー
                    </Link>
                    をご確認ください。
                </p>
                <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" onClick={handleReject}>
                        拒否する
                    </Button>
                    <Button type="button" onClick={handleAccept}>
                        同意する
                    </Button>
                </div>
            </div>
        </section>
    );
};
