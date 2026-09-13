import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import type { PackingItem } from '@/features/plans/types';

const toggleConfirmItem = vi.fn();
const uncompletePacking = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/features/plans/server/actions', () => ({
    toggleConfirmItem: (...args: unknown[]) => toggleConfirmItem(...args),
    uncompletePacking: (...args: unknown[]) => uncompletePacking(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: routerRefresh }),
}));

import { ForgottenItemChecklist } from './ForgottenItemChecklist';

const createItem = (overrides: Partial<PackingItem> = {}): PackingItem => ({
    id: 'item-1',
    name: 'マスク',
    isChecked: true,
    isConfirmed: false,
    position: 0,
    ...overrides,
});

const defaultItems: PackingItem[] = [
    createItem({ id: 'item-1', name: 'マスク', isConfirmed: true, position: 0 }),
    createItem({ id: 'item-2', name: 'フィン', isConfirmed: false, position: 1 }),
    createItem({ id: 'item-3', name: 'レギュレーター', isConfirmed: false, position: 2 }),
];

const allConfirmedItems: PackingItem[] = [
    createItem({ id: 'item-1', name: 'マスク', isConfirmed: true, position: 0 }),
    createItem({ id: 'item-2', name: 'フィン', isConfirmed: true, position: 1 }),
];

describe('ForgottenItemChecklist', () => {
    beforeEach(() => {
        toggleConfirmItem.mockReset();
        uncompletePacking.mockReset();
        routerRefresh.mockReset();
    });

    describe('進捗表示', () => {
        it('確認済み件数と全体件数を「N / M 確認済み」の形式で表示する', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('/ 3 確認済み')).toBeInTheDocument();
        });

        it('progressbar に現在値と最大値を反映する', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            const progressbar = screen.getByRole('progressbar', { name: '忘れ物確認の進捗' });
            expect(progressbar).toHaveAttribute('aria-valuenow', '1');
            expect(progressbar).toHaveAttribute('aria-valuemax', '3');
        });

        it('items が空のとき progressbar の最大値は 0 になる', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={[]} />);

            const progressbar = screen.getByRole('progressbar', { name: '忘れ物確認の進捗' });
            expect(progressbar).toHaveAttribute('aria-valuenow', '0');
            expect(progressbar).toHaveAttribute('aria-valuemax', '0');
        });
    });

    describe('全項目確認済みの表示', () => {
        it('全項目が確認済みのとき role="status" で完了メッセージを表示する', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={allConfirmedItems} />);

            expect(screen.getByRole('status')).toHaveTextContent('忘れ物なし！すべての持ち物を確認しました');
        });

        it('未確認項目が残っているとき完了メッセージを表示しない', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        it('items が空のとき完了メッセージを表示しない', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={[]} />);

            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });

    describe('チェックボックス操作', () => {
        it('未確認項目のチェックボックスを変更すると toggleConfirmItem を isConfirmed=true で呼ぶ', async () => {
            toggleConfirmItem.mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));

            expect(toggleConfirmItem).toHaveBeenCalledWith('item-2', true);
        });

        it('確認済み項目のチェックボックスを変更すると toggleConfirmItem を isConfirmed=false で呼ぶ', async () => {
            toggleConfirmItem.mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'マスク' }));

            expect(toggleConfirmItem).toHaveBeenCalledWith('item-1', false);
        });

        it('成功時に router.refresh を呼ぶ', async () => {
            toggleConfirmItem.mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));

            expect(routerRefresh).toHaveBeenCalled();
        });

        it('toggleConfirmItem が失敗すると role="alert" でエラーを表示し router.refresh しない', async () => {
            toggleConfirmItem.mockResolvedValueOnce({ success: false, error: '確認状態の保存に失敗しました' });
            const user = userEvent.setup();
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));

            expect(await screen.findByRole('alert')).toHaveTextContent('確認状態の保存に失敗しました');
            expect(routerRefresh).not.toHaveBeenCalled();
        });

        it('エラー表示後に再度チェックボックスを操作するとエラーがリセットされる', async () => {
            toggleConfirmItem
                .mockResolvedValueOnce({ success: false, error: '確認状態の保存に失敗しました' })
                .mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));
            expect(await screen.findByRole('alert')).toBeInTheDocument();

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('完了解除', () => {
        it('「完了を解除」ボタンをクリックすると uncompletePacking を planId で呼ぶ', async () => {
            uncompletePacking.mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            await user.click(screen.getByRole('button', { name: '完了を解除' }));

            expect(uncompletePacking).toHaveBeenCalledWith('plan-1');
        });

        it('完了解除が成功すると router.refresh を呼ぶ', async () => {
            uncompletePacking.mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            await user.click(screen.getByRole('button', { name: '完了を解除' }));

            expect(routerRefresh).toHaveBeenCalled();
        });

        it('完了解除が失敗すると role="alert" でエラーを表示し router.refresh しない', async () => {
            uncompletePacking.mockResolvedValueOnce({ success: false, error: '完了解除に失敗しました' });
            const user = userEvent.setup();
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            await user.click(screen.getByRole('button', { name: '完了を解除' }));

            expect(await screen.findByRole('alert')).toHaveTextContent('完了解除に失敗しました');
            expect(routerRefresh).not.toHaveBeenCalled();
        });
    });

    describe('readOnly=true のとき', () => {
        it('チェックボックスが disabled になる', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} readOnly />);

            expect(screen.getByRole('checkbox', { name: 'マスク' })).toBeDisabled();
            expect(screen.getByRole('checkbox', { name: 'フィン' })).toBeDisabled();
        });

        it('「完了を解除」ボタンを表示しない', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} readOnly />);

            expect(screen.queryByRole('button', { name: '完了を解除' })).not.toBeInTheDocument();
        });
    });

    describe('readOnly=false（既定）のとき', () => {
        it('チェックボックスが有効になる', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            expect(screen.getByRole('checkbox', { name: 'マスク' })).not.toBeDisabled();
        });

        it('「完了を解除」ボタンを表示する', () => {
            render(<ForgottenItemChecklist planId="plan-1" items={defaultItems} />);

            expect(screen.getByRole('button', { name: '完了を解除' })).toBeInTheDocument();
        });
    });
});
