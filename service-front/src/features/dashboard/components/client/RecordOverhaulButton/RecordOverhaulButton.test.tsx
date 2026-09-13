import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const routerRefresh = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: routerRefresh }),
}));

import { RecordOverhaulButton } from './RecordOverhaulButton';

describe('RecordOverhaulButton', () => {
    const onRecord = vi.fn();

    beforeEach(() => {
        onRecord.mockReset();
        routerRefresh.mockReset();
    });

    it('初期状態ではダイアログを表示しない', () => {
        render(<RecordOverhaulButton regulatorId="reg-1" onRecord={onRecord} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ボタンを押すと確認ダイアログを表示する', async () => {
        const user = userEvent.setup();
        render(<RecordOverhaulButton regulatorId="reg-1" onRecord={onRecord} />);

        await user.click(screen.getByRole('button', { name: 'メンテ完了を記録' }));

        expect(screen.getByRole('dialog', { name: 'メンテ完了を記録しますか？' })).toBeInTheDocument();
        expect(screen.getByText('前回 OH 日を今日に更新します。よろしいですか？')).toBeInTheDocument();
    });

    it('キャンセルでダイアログを閉じ onRecord は呼ばれない', async () => {
        const user = userEvent.setup();
        render(<RecordOverhaulButton regulatorId="reg-1" onRecord={onRecord} />);

        await user.click(screen.getByRole('button', { name: 'メンテ完了を記録' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onRecord).not.toHaveBeenCalled();
    });

    it('Esc キーでダイアログを閉じる', async () => {
        const user = userEvent.setup();
        render(<RecordOverhaulButton regulatorId="reg-1" onRecord={onRecord} />);

        await user.click(screen.getByRole('button', { name: 'メンテ完了を記録' }));
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('記録成功時に onRecord(regulatorId) を呼びダイアログを閉じて再取得する', async () => {
        onRecord.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<RecordOverhaulButton regulatorId="reg-1" onRecord={onRecord} />);

        await user.click(screen.getByRole('button', { name: 'メンテ完了を記録' }));
        await user.click(screen.getByRole('button', { name: '記録する' }));

        expect(onRecord).toHaveBeenCalledWith('reg-1');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(routerRefresh).toHaveBeenCalled();
    });

    it('onRecord が失敗するとダイアログを閉じてエラーメッセージを表示し再取得しない', async () => {
        onRecord.mockResolvedValueOnce({ success: false, error: 'メンテ完了の記録に失敗しました' });
        const user = userEvent.setup();
        render(<RecordOverhaulButton regulatorId="reg-1" onRecord={onRecord} />);

        await user.click(screen.getByRole('button', { name: 'メンテ完了を記録' }));
        await user.click(screen.getByRole('button', { name: '記録する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('メンテ完了の記録に失敗しました');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(routerRefresh).not.toHaveBeenCalled();
    });
});
