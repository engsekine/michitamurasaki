import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface CookieConsentStore {
    /** フッター「Cookie 設定」からの再表示シグナル（同意済みでもバナーを開く） */
    forcedOpen: boolean;
    openSettings: () => void;
    close: () => void;
}

/**
 * Cookie 同意バナーの再表示シグナルを共有するストア（017-cookie-consent）。
 * 永続値は Cookie 側が持つため、ここでは非永続の UI シグナルのみを扱う。
 */
export const useCookieConsentStore = create<CookieConsentStore>()(
    devtools(
        (set) => ({
            forcedOpen: false,
            openSettings: () => set({ forcedOpen: true }),
            close: () => set({ forcedOpen: false }),
        }),
        { name: 'CookieConsentStore' },
    ),
);
