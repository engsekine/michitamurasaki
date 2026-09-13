import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDiveVisibility } from '@/features/dives/server/actions';
import { SITE_URL } from '@/shared/constants/site';
import { DiveVisibilityToggle } from './DiveVisibilityToggle';

vi.mock('@/features/dives/server/actions', () => ({
    setDiveVisibility: vi.fn(),
}));

const mockedSetDiveVisibility = vi.mocked(setDiveVisibility);

describe('DiveVisibilityToggle', () => {
    beforeEach(() => {
        mockedSetDiveVisibility.mockReset();
    });

    it('初期状態を switch の aria-checked とラベルに反映する', () => {
        render(<DiveVisibilityToggle diveId="d1" initialIsPublic={false} />);
        const toggle = screen.getByRole('switch', { name: 'このログを公開する' });
        expect(toggle).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByText('非公開')).toBeInTheDocument();
    });

    it('公開化に成功すると公開状態になり共有リンク(/dives/[id])を表示する', async () => {
        mockedSetDiveVisibility.mockResolvedValue({ success: true, isPublic: true });
        const user = userEvent.setup();
        render(<DiveVisibilityToggle diveId="d1" initialIsPublic={false} />);

        await user.click(screen.getByRole('switch'));

        expect(mockedSetDiveVisibility).toHaveBeenCalledWith('d1', true);
        await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'));
        expect(screen.getByRole('textbox', { name: '共有リンク' })).toHaveValue(`${SITE_URL}/dives/d1`);
    });

    it('失敗時は role="alert" でエラーを表示し、状態を変えない', async () => {
        mockedSetDiveVisibility.mockResolvedValue({ success: false, error: '公開設定の更新に失敗しました' });
        const user = userEvent.setup();
        render(<DiveVisibilityToggle diveId="d1" initialIsPublic={false} />);

        await user.click(screen.getByRole('switch'));

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('公開設定の更新に失敗しました'));
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    it('公開中は共有リンク(/dives/[id])を絶対 URL で表示する', () => {
        render(<DiveVisibilityToggle diveId="d1" initialIsPublic />);
        expect(screen.getByRole('textbox', { name: '共有リンク' })).toHaveValue(`${SITE_URL}/dives/d1`);
    });

    it('「コピー」で絶対 URL をクリップボードへ書き込む', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        // userEvent.setup() は navigator.clipboard を独自スタブへ差し替えるため、setup 後に上書きする
        const user = userEvent.setup();
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        render(<DiveVisibilityToggle diveId="d1" initialIsPublic />);

        await user.click(screen.getByRole('button', { name: 'コピー' }));

        expect(writeText).toHaveBeenCalledWith(`${SITE_URL}/dives/d1`);
        await waitFor(() => expect(screen.getByRole('button', { name: 'コピーしました' })).toBeInTheDocument());
    });
});
