import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'ログを削除しますか？',
    description: 'この操作は取り消せません。',
    onConfirm: vi.fn(),
};

describe('ConfirmDialog', () => {
    it('open=true でタイトル・説明・ボタンを表示する', () => {
        render(<ConfirmDialog {...defaultProps} confirmLabel="削除する" />);

        const dialog = screen.getByRole('dialog', { name: 'ログを削除しますか？' });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText('この操作は取り消せません。')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '削除する' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    });

    it('open=false では何も表示しない', () => {
        render(<ConfirmDialog {...defaultProps} open={false} />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('実行ボタンで onConfirm を呼ぶ', async () => {
        const onConfirm = vi.fn();
        const user = userEvent.setup();
        render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} confirmLabel="削除する" />);

        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('キャンセルで onOpenChange(false) を呼び、onConfirm は呼ばない', async () => {
        const onOpenChange = vi.fn();
        const onConfirm = vi.fn();
        const user = userEvent.setup();
        render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} onConfirm={onConfirm} />);

        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('isPending 中は両ボタンが disabled で処理中表示になる', () => {
        render(<ConfirmDialog {...defaultProps} isPending confirmLabel="削除する" />);

        expect(screen.getByRole('button', { name: '処理中...' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();
    });

    it('Esc キーで onOpenChange(false) を呼ぶ', async () => {
        const onOpenChange = vi.fn();
        const user = userEvent.setup();
        render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

        await user.keyboard('{Escape}');

        /** Dialog 内部経由の呼び出しは第 2 引数にイベント詳細が付くため第 1 引数のみ検証する */
        expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    });
});
