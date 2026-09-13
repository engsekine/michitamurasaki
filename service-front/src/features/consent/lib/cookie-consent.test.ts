import { afterEach, describe, expect, it } from 'vitest';

import {
    COOKIE_CONSENT_MAX_AGE_SECONDS,
    COOKIE_CONSENT_NAME,
    getCookieConsentClient,
    getCookieConsentServer,
    serializeConsentCookie,
    setCookieConsent,
} from './cookie-consent';

const clearCookie = () => {
    // biome-ignore lint/suspicious/noDocumentCookie: テストで Cookie 状態を直接準備するため
    document.cookie = `${COOKIE_CONSENT_NAME}=; Max-Age=0; Path=/`;
};

afterEach(clearCookie);

describe('getCookieConsentServer', () => {
    it('accepted / rejected はそのまま、それ以外は null に正規化する', () => {
        expect(getCookieConsentServer('accepted')).toBe('accepted');
        expect(getCookieConsentServer('rejected')).toBe('rejected');
        expect(getCookieConsentServer(undefined)).toBeNull();
        expect(getCookieConsentServer('foo')).toBeNull(); // 破損・改ざん値
    });
});

describe('getCookieConsentClient', () => {
    it('document.cookie の値を読み、破損値は null を返す', () => {
        // biome-ignore lint/suspicious/noDocumentCookie: テストで Cookie 状態を直接準備するため
        document.cookie = `${COOKIE_CONSENT_NAME}=accepted; Path=/`;
        expect(getCookieConsentClient()).toBe('accepted');

        clearCookie();
        // biome-ignore lint/suspicious/noDocumentCookie: テストで Cookie 状態を直接準備するため
        document.cookie = `${COOKIE_CONSENT_NAME}=garbage; Path=/`;
        expect(getCookieConsentClient()).toBeNull();
    });

    it('未設定なら null', () => {
        clearCookie();
        expect(getCookieConsentClient()).toBeNull();
    });
});

describe('serializeConsentCookie', () => {
    it('Max-Age(365日) / Path / SameSite を含む', () => {
        const cookie = serializeConsentCookie('accepted', false);
        expect(cookie).toContain(`${COOKIE_CONSENT_NAME}=accepted`);
        expect(cookie).toContain(`Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}`);
        expect(COOKIE_CONSENT_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 365); // FR-005: 12 か月
        expect(cookie).toContain('Path=/');
        expect(cookie).toContain('SameSite=Lax');
        expect(cookie).not.toContain('Secure');
    });

    it('isSecure=true で Secure を付与する', () => {
        expect(serializeConsentCookie('rejected', true)).toContain('; Secure');
    });
});

describe('setCookieConsent', () => {
    it('書き込んだ値を getCookieConsentClient で読み戻せる', () => {
        setCookieConsent('rejected');
        expect(getCookieConsentClient()).toBe('rejected');
    });
});
