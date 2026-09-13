import { beforeEach, describe, expect, it } from 'vitest';

import { useCookieConsentStore } from './store';

describe('useCookieConsentStore', () => {
    beforeEach(() => {
        useCookieConsentStore.setState({ forcedOpen: false });
    });

    it('openSettings で forcedOpen が true になる', () => {
        useCookieConsentStore.getState().openSettings();
        expect(useCookieConsentStore.getState().forcedOpen).toBe(true);
    });

    it('close で forcedOpen が false になる', () => {
        useCookieConsentStore.getState().openSettings();
        useCookieConsentStore.getState().close();
        expect(useCookieConsentStore.getState().forcedOpen).toBe(false);
    });
});
