import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiveBuddyField } from './DiveBuddyField';

describe('DiveBuddyField', () => {
    it('fieldset/legend でグループ化して描画する', () => {
        render(<DiveBuddyField value={[]} onChange={vi.fn()} />);
        expect(screen.getByRole('group', { name: '同行したバディ' })).toBeInTheDocument();
    });

    it('「バディを追加」で空のフリーテキスト行を追加する', async () => {
        const handleChange = vi.fn();
        const user = userEvent.setup();
        render(<DiveBuddyField value={[]} onChange={handleChange} />);

        await user.click(screen.getByRole('button', { name: 'バディを追加' }));

        expect(handleChange).toHaveBeenCalledWith([{ name: '' }]);
    });

    it('フリーテキスト名の入力を onChange に反映する', async () => {
        const handleChange = vi.fn();
        const user = userEvent.setup();
        render(<DiveBuddyField value={[{ name: '' }]} onChange={handleChange} />);

        await user.type(screen.getByLabelText('バディ名 1'), 'A');

        expect(handleChange).toHaveBeenLastCalledWith([{ name: 'A' }]);
    });

    it('削除ボタンで該当フリーテキスト行を除去する', async () => {
        const handleChange = vi.fn();
        const user = userEvent.setup();
        render(<DiveBuddyField value={[{ name: '海太郎' }, { name: '山子' }]} onChange={handleChange} />);

        await user.click(screen.getByRole('button', { name: 'バディ 1 を削除' }));

        expect(handleChange).toHaveBeenCalledWith([{ name: '山子' }]);
    });

    it('登録済みバディはチップ表示し、削除できる（追加 UI は別途）', async () => {
        const handleChange = vi.fn();
        const user = userEvent.setup();
        render(
            <DiveBuddyField
                value={[{ userId: '123e4567-e89b-12d3-a456-426614174000' }, { name: '海太郎' }]}
                onChange={handleChange}
            />,
        );

        expect(screen.getByText('登録済みバディ')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '登録済みバディを削除' }));

        expect(handleChange).toHaveBeenCalledWith([{ name: '海太郎' }]);
    });

    it('登録済みバディの nickname があればチップに表示する', () => {
        render(
            <DiveBuddyField
                value={[{ userId: '123e4567-e89b-12d3-a456-426614174000', nickname: 'はなこ' }]}
                onChange={vi.fn()}
            />,
        );

        expect(screen.getByText('はなこ')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'はなこを削除' })).toBeInTheDocument();
    });

    it('error を role="alert" で表示する', () => {
        render(<DiveBuddyField value={[]} onChange={vi.fn()} error="バディの指定が不正です" />);
        expect(screen.getByRole('alert')).toHaveTextContent('バディの指定が不正です');
    });
});
