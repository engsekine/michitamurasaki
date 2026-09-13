import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCookieConsentStore } from '@/features/consent/lib/store';

import { CookieSettingsButton } from './CookieSettingsButton';

describe('CookieSettingsButton', () => {
    beforeEach(() => {
        useCookieConsentStore.setState({ forcedOpen: false });
    });

    it('「Cookie 設定」ボタンを表示する', () => {
        render(<CookieSettingsButton />);
        expect(screen.getByRole('button', { name: 'Cookie 設定' })).toBeInTheDocument();
    });

    it('押下で forcedOpen を true にする（バナー再表示）', async () => {
        const user = userEvent.setup();
        render(<CookieSettingsButton />);

        await user.click(screen.getByRole('button', { name: 'Cookie 設定' }));

        expect(useCookieConsentStore.getState().forcedOpen).toBe(true);
    });
});
