'use client';

import { useCookieConsentStore } from '@/features/consent/lib/store';

/**
 * フッターに置く「Cookie 設定」ボタン（017-cookie-consent / FR-009）。
 * 押下で同意バナーを再表示し、選択済みでも変更できるようにする。
 */
export const CookieSettingsButton = () => {
    const openSettings = useCookieConsentStore((state) => state.openSettings);

    return (
        <button type="button" onClick={openSettings} className="text-muted-foreground text-sm hover:text-foreground">
            Cookie 設定
        </button>
    );
};
