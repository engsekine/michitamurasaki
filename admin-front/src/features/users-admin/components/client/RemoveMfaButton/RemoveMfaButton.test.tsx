import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const removeMfaFactor = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh }),
}));

vi.mock('@/features/users-admin/server/actions', () => ({
    removeMfaFactor: (...args: unknown[]) => removeMfaFactor(...args),
}));

/** ConfirmDialog は open のとき確認ボタンを出す軽量スタブに差し替える */
vi.mock('@/shared/components/feedback/ConfirmDialog', () => ({
    ConfirmDialog: ({
        open,
        onConfirm,
        confirmLabel,
    }: {
        open: boolean;
        onConfirm: () => void;
        confirmLabel: string;
    }) =>
        open ? (
            <button type="button" onClick={onConfirm}>
                {confirmLabel}
            </button>
        ) : null,
}));

import { RemoveMfaButton } from './RemoveMfaButton';

describe('RemoveMfaButton', () => {
    beforeEach(() => {
        removeMfaFactor.mockReset();
        refresh.mockReset();
    });

    it('確認後に removeMfaFactor を userId で呼び、成功時は状態を通知して refresh する', async () => {
        removeMfaFactor.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<RemoveMfaButton userId="user-1" />);

        await user.click(screen.getByRole('button', { name: '2 要素認証を解除' }));
        await user.click(screen.getByRole('button', { name: '解除する' }));

        expect(removeMfaFactor).toHaveBeenCalledWith('user-1');
        expect(await screen.findByRole('status')).toHaveTextContent('2 要素認証を解除しました');
        expect(refresh).toHaveBeenCalled();
    });

    it('失敗時は alert を表示し refresh しない', async () => {
        removeMfaFactor.mockResolvedValueOnce({ success: false, error: '2 要素認証要素の解除に失敗しました' });
        const user = userEvent.setup();
        render(<RemoveMfaButton userId="user-1" />);

        await user.click(screen.getByRole('button', { name: '2 要素認証を解除' }));
        await user.click(screen.getByRole('button', { name: '解除する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('解除に失敗しました');
        expect(refresh).not.toHaveBeenCalled();
    });
});
