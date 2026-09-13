import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setCookieConsent = vi.fn();

vi.mock('@/features/consent/lib/cookie-consent', () => ({
    setCookieConsent: (...args: unknown[]) => setCookieConsent(...args),
}));

import { useCookieConsentStore } from '@/features/consent/lib/store';

import { CookieConsentBanner } from './CookieConsentBanner';

describe('CookieConsentBanner', () => {
    beforeEach(() => {
        setCookieConsent.mockReset();
        useCookieConsentStore.setState({ forcedOpen: false });
    });

    it('未選択（initialConsent=null）のとき同意/拒否/ポリシーリンクを表示する', () => {
        render(<CookieConsentBanner initialConsent={null} />);
        expect(screen.getByRole('region', { name: 'Cookie の利用について' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '同意する' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '拒否する' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'プライバシーポリシー' })).toHaveAttribute('href', '/privacy-policy');
    });

    it('選択済み（initialConsent=accepted）のとき表示しない', () => {
        render(<CookieConsentBanner initialConsent="accepted" />);
        expect(screen.queryByRole('region', { name: 'Cookie の利用について' })).not.toBeInTheDocument();
    });

    it('「同意する」で setCookieConsent(accepted) を呼びバナーを閉じる', async () => {
        const user = userEvent.setup();
        render(<CookieConsentBanner initialConsent={null} />);

        await user.click(screen.getByRole('button', { name: '同意する' }));

        expect(setCookieConsent).toHaveBeenCalledWith('accepted');
        expect(screen.queryByRole('region', { name: 'Cookie の利用について' })).not.toBeInTheDocument();
    });

    it('「拒否する」で setCookieConsent(rejected) を呼ぶ', async () => {
        const user = userEvent.setup();
        render(<CookieConsentBanner initialConsent={null} />);

        await user.click(screen.getByRole('button', { name: '拒否する' }));

        expect(setCookieConsent).toHaveBeenCalledWith('rejected');
    });

    it('選択済みでも forcedOpen（フッターから再表示）なら表示する', () => {
        useCookieConsentStore.setState({ forcedOpen: true });
        render(<CookieConsentBanner initialConsent="accepted" />);
        expect(screen.getByRole('region', { name: 'Cookie の利用について' })).toBeInTheDocument();
    });
});
