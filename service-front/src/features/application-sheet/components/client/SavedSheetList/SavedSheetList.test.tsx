import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

import { SavedSheetList } from './SavedSheetList';

const deleteApplicationSheet = vi.fn();
const refresh = vi.fn();
const push = vi.fn();

vi.mock('../../../server/actions', () => ({
    deleteApplicationSheet: (...args: unknown[]) => deleteApplicationSheet(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh, push }),
}));

const sheets = [
    { id: 'sheet-2', name: 'B ショップ用', updatedAt: '2026-07-11T02:30:00Z' },
    { id: 'sheet-1', name: 'A ショップ用', updatedAt: '2026-07-10T01:00:00Z' },
];

describe('SavedSheetList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        deleteApplicationSheet.mockResolvedValue({ success: true });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('シート名と更新日時つきで一覧表示し、選択リンクが ?sheet= を指す', () => {
        render(<SavedSheetList sheets={sheets} selectedSheetId={null} />);

        const links = screen.getAllByRole('link');
        expect(links[0]).toHaveTextContent('B ショップ用');
        expect(links[0]).toHaveAttribute('href', '/application-sheet?sheet=sheet-2');
        expect(links[1]).toHaveTextContent('A ショップ用');
        expect(links[1]).toHaveAttribute('href', '/application-sheet?sheet=sheet-1');
        // JST 表示の更新日時
        expect(screen.getByText(/2026\/07\/11/)).toBeInTheDocument();
    });

    it('選択中のシートに aria-current が付く', () => {
        render(<SavedSheetList sheets={sheets} selectedSheetId="sheet-1" />);

        expect(screen.getByRole('link', { name: /A ショップ用/ })).toHaveAttribute('aria-current', 'true');
        expect(screen.getByRole('link', { name: /B ショップ用/ })).not.toHaveAttribute('aria-current');
    });

    it('削除ボタンで確認のうえ deleteApplicationSheet が呼ばれ、一覧が更新される', async () => {
        const user = userEvent.setup();
        render(<SavedSheetList sheets={sheets} selectedSheetId={null} />);

        await user.click(screen.getByRole('button', { name: 'B ショップ用を削除' }));

        expect(window.confirm).toHaveBeenCalled();
        expect(deleteApplicationSheet).toHaveBeenCalledWith('sheet-2');
        expect(refresh).toHaveBeenCalled();
    });

    it('確認をキャンセルすると削除しない', async () => {
        const user = userEvent.setup();
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        render(<SavedSheetList sheets={sheets} selectedSheetId={null} />);

        await user.click(screen.getByRole('button', { name: 'B ショップ用を削除' }));

        expect(deleteApplicationSheet).not.toHaveBeenCalled();
    });

    it('選択中のシートを削除すると新規作成状態（/application-sheet）へ戻る', async () => {
        const user = userEvent.setup();
        render(<SavedSheetList sheets={sheets} selectedSheetId="sheet-2" />);

        await user.click(screen.getByRole('button', { name: 'B ショップ用を削除' }));

        expect(deleteApplicationSheet).toHaveBeenCalledWith('sheet-2');
        expect(push).toHaveBeenCalledWith('/application-sheet');
    });

    it('削除に失敗するとエラーメッセージが role="alert" で表示される', async () => {
        const user = userEvent.setup();
        deleteApplicationSheet.mockResolvedValue({
            success: false,
            error: '削除に失敗しました。時間をおいて再度お試しください',
        });
        render(<SavedSheetList sheets={sheets} selectedSheetId={null} />);

        await user.click(screen.getByRole('button', { name: 'B ショップ用を削除' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('削除に失敗しました。時間をおいて再度お試しください');
    });
});
