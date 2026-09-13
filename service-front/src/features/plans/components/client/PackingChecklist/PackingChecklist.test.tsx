import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import type { PackingItem } from '@/features/plans/types';

const togglePackingItem = vi.fn();
const completePacking = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/features/plans/server/actions', () => ({
    togglePackingItem: (...args: unknown[]) => togglePackingItem(...args),
    completePacking: (...args: unknown[]) => completePacking(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: routerRefresh }),
}));

import { PackingChecklist } from './PackingChecklist';

const createItem = (overrides: Partial<PackingItem> = {}): PackingItem => ({
    id: 'item-1',
    name: 'マスク',
    isChecked: false,
    isConfirmed: false,
    position: 0,
    ...overrides,
});

const defaultItems: PackingItem[] = [
    createItem({ id: 'item-1', name: 'マスク', isChecked: true, position: 0 }),
    createItem({ id: 'item-2', name: 'フィン', isChecked: false, position: 1 }),
    createItem({ id: 'item-3', name: 'レギュレーター', isChecked: false, position: 2 }),
];

describe('PackingChecklist', () => {
    beforeEach(() => {
        togglePackingItem.mockReset();
        completePacking.mockReset();
        routerRefresh.mockReset();
    });

    describe('準備完了ボタン（037）', () => {
        it('planId と canComplete=true が指定されたとき「準備完了にする」ボタンを表示し、クリックで completePacking を呼ぶ', async () => {
            completePacking.mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<PackingChecklist planId="plan-1" items={defaultItems} canComplete />);

            await user.click(screen.getByRole('button', { name: '準備完了にする' }));

            expect(completePacking).toHaveBeenCalledWith('plan-1');
            expect(routerRefresh).toHaveBeenCalled();
        });

        it('canComplete 未指定では「準備完了にする」ボタンを表示しない（既存利用への影響なし）', () => {
            render(<PackingChecklist items={defaultItems} />);

            expect(screen.queryByRole('button', { name: '準備完了にする' })).not.toBeInTheDocument();
        });

        it('持ち物 0 件では canComplete=true でもボタンを表示しない（FR-007）', () => {
            render(<PackingChecklist planId="plan-1" items={[]} canComplete />);

            expect(screen.queryByRole('button', { name: '準備完了にする' })).not.toBeInTheDocument();
        });

        it('completePacking が失敗すると role="alert" でエラーを表示する', async () => {
            completePacking.mockResolvedValueOnce({ success: false, error: '完了の保存に失敗しました' });
            const user = userEvent.setup();
            render(<PackingChecklist planId="plan-1" items={defaultItems} canComplete />);

            await user.click(screen.getByRole('button', { name: '準備完了にする' }));

            expect(await screen.findByRole('alert')).toHaveTextContent('完了の保存に失敗しました');
            expect(routerRefresh).not.toHaveBeenCalled();
        });
    });

    describe('items が空のとき', () => {
        it('「持ち物はまだありません」を表示する', () => {
            render(<PackingChecklist items={[]} />);

            expect(screen.getByText('持ち物はまだありません')).toBeInTheDocument();
        });

        it('チェックボックスを表示しない', () => {
            render(<PackingChecklist items={[]} />);

            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        });
    });

    describe('items がある場合の表示', () => {
        it('全項目のチェックボックスとラベルを表示する', () => {
            render(<PackingChecklist items={defaultItems} />);

            expect(screen.getByRole('checkbox', { name: 'マスク' })).toBeInTheDocument();
            expect(screen.getByRole('checkbox', { name: 'フィン' })).toBeInTheDocument();
            expect(screen.getByRole('checkbox', { name: 'レギュレーター' })).toBeInTheDocument();
        });

        it('isChecked=true の項目のチェックボックスは checked になっている', () => {
            render(<PackingChecklist items={defaultItems} />);

            expect(screen.getByRole('checkbox', { name: 'マスク' })).toBeChecked();
        });

        it('isChecked=false の項目のチェックボックスは unchecked になっている', () => {
            render(<PackingChecklist items={defaultItems} />);

            expect(screen.getByRole('checkbox', { name: 'フィン' })).not.toBeChecked();
        });

        it('初期状態でエラーメッセージを表示しない', () => {
            render(<PackingChecklist items={defaultItems} />);

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('チェックボックス操作', () => {
        it('未チェック項目のチェックボックスを変更すると togglePackingItem を isChecked=true で呼ぶ', async () => {
            togglePackingItem.mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<PackingChecklist items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));

            expect(togglePackingItem).toHaveBeenCalledWith('item-2', true);
        });

        it('チェック済み項目のチェックボックスを変更すると togglePackingItem を isChecked=false で呼ぶ', async () => {
            togglePackingItem.mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<PackingChecklist items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'マスク' }));

            expect(togglePackingItem).toHaveBeenCalledWith('item-1', false);
        });

        it('成功時に router.refresh を呼ぶ', async () => {
            togglePackingItem.mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<PackingChecklist items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));

            expect(routerRefresh).toHaveBeenCalled();
        });

        it('Server Action が失敗すると role="alert" でエラーを表示し router.refresh しない', async () => {
            togglePackingItem.mockResolvedValueOnce({ success: false, error: 'チェック状態の保存に失敗しました' });
            const user = userEvent.setup();
            render(<PackingChecklist items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));

            expect(await screen.findByRole('alert')).toHaveTextContent('チェック状態の保存に失敗しました');
            expect(routerRefresh).not.toHaveBeenCalled();
        });

        it('エラー表示後に再度チェックボックスを操作するとエラーがリセットされる', async () => {
            togglePackingItem
                .mockResolvedValueOnce({ success: false, error: 'チェック状態の保存に失敗しました' })
                .mockResolvedValueOnce({ success: true });
            const user = userEvent.setup();
            render(<PackingChecklist items={defaultItems} />);

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));
            expect(await screen.findByRole('alert')).toBeInTheDocument();

            await user.click(screen.getByRole('checkbox', { name: 'フィン' }));

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });
});
