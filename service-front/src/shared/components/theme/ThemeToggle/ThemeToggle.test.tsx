import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { THEME_STORAGE_KEY, ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
    beforeEach(() => {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem(THEME_STORAGE_KEY);
    });

    it('ライト状態では aria-pressed=false のトグルを表示する', () => {
        render(<ThemeToggle />);

        const button = screen.getByRole('button', { name: 'ダークモードを切り替える' });
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('クリックで html に dark クラスを付与し、選択を保存する', async () => {
        const user = userEvent.setup();
        render(<ThemeToggle />);

        await user.click(screen.getByRole('button', { name: 'ダークモードを切り替える' }));

        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(screen.getByRole('button', { name: 'ダークモードを切り替える' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('ダーク状態からのクリックでライトに戻す', async () => {
        document.documentElement.classList.add('dark');
        const user = userEvent.setup();
        render(<ThemeToggle />);

        await user.click(screen.getByRole('button', { name: 'ダークモードを切り替える' }));

        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });
});
