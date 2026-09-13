import { afterEach, describe, expect, it, vi } from 'vitest';

import { COOKIE_CONSENT_NAME } from './cookie-consent';
import { runWhenConsented } from './gating';

const setConsent = (value: string) => {
    // biome-ignore lint/suspicious/noDocumentCookie: テストで Cookie 状態を直接準備するため
    document.cookie = `${COOKIE_CONSENT_NAME}=${value}; Path=/`;
};
const clearConsent = () => {
    // biome-ignore lint/suspicious/noDocumentCookie: テストで Cookie 状態を直接準備するため
    document.cookie = `${COOKIE_CONSENT_NAME}=; Max-Age=0; Path=/`;
};

afterEach(clearConsent);

describe('runWhenConsented', () => {
    it('同意済み（accepted）のときだけ被ゲート処理を実行する（FR-007 / SC-003）', () => {
        setConsent('accepted');
        const loader = vi.fn();
        const ran = runWhenConsented(loader);
        expect(loader).toHaveBeenCalledTimes(1);
        expect(ran).toBe(true);
    });

    it('拒否（rejected）では実行しない（FR-006）', () => {
        setConsent('rejected');
        const loader = vi.fn();
        const ran = runWhenConsented(loader);
        expect(loader).not.toHaveBeenCalled();
        expect(ran).toBe(false);
    });

    it('未選択（Cookie なし）では実行しない（FR-006）', () => {
        clearConsent();
        const loader = vi.fn();
        const ran = runWhenConsented(loader);
        expect(loader).not.toHaveBeenCalled();
        expect(ran).toBe(false);
    });

    it('loader が例外を投げても伝播させず false を返す', () => {
        setConsent('accepted');
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const loader = vi.fn(() => {
            throw new Error('boom');
        });

        expect(() => runWhenConsented(loader)).not.toThrow();
        expect(runWhenConsented(loader)).toBe(false);

        consoleError.mockRestore();
    });
});
