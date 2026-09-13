import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { RENTAL_ITEMS } from '../../../constants';
import { RentalItemsField } from './RentalItemsField';

const defaultProps = {
    hasRental: '' as const,
    onHasRentalChange: vi.fn(),
    selectedItems: [],
    onSelectedItemsChange: vi.fn(),
    omitRentalBlock: false,
    onOmitRentalBlockChange: vi.fn(),
};

describe('RentalItemsField', () => {
    it('有 / 無のラジオが表示され、選択でコールバックが呼ばれる', async () => {
        const user = userEvent.setup();
        const onHasRentalChange = vi.fn();
        render(<RentalItemsField {...defaultProps} onHasRentalChange={onHasRentalChange} />);

        expect(screen.getByRole('radio', { name: '有' })).toBeInTheDocument();
        await user.click(screen.getByRole('radio', { name: '無' }));

        expect(onHasRentalChange).toHaveBeenCalledWith('no');
    });

    it('「有」選択時は品目 14 種が RENTAL_ITEMS の並びで表示され、省略トグルは出ない', () => {
        render(<RentalItemsField {...defaultProps} hasRental="yes" />);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(RENTAL_ITEMS.length);
        expect(checkboxes.map((checkbox) => checkbox.getAttribute('value'))).toEqual(
            RENTAL_ITEMS.map((item) => item.key),
        );
        for (const item of RENTAL_ITEMS) {
            expect(screen.getByLabelText(item.label)).toBeInTheDocument();
        }
        expect(screen.queryByLabelText(/未該当ブロックを省略する/)).not.toBeInTheDocument();
    });

    it('「無」選択時は品目チェックボックスが出ず、省略トグルが表示される（FR-011 / FR-012）', async () => {
        const user = userEvent.setup();
        const onOmitRentalBlockChange = vi.fn();
        render(<RentalItemsField {...defaultProps} hasRental="no" onOmitRentalBlockChange={onOmitRentalBlockChange} />);

        expect(screen.queryByLabelText(RENTAL_ITEMS[0]?.label ?? '')).not.toBeInTheDocument();

        const toggle = screen.getByLabelText(/未該当ブロックを省略する/);
        await user.click(toggle);

        expect(onOmitRentalBlockChange).toHaveBeenCalledWith(true);
    });

    it('未選択のときは品目・省略トグルとも表示されない', () => {
        render(<RentalItemsField {...defaultProps} hasRental="" />);

        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('品目のチェックで選択キーが追加され、解除で取り除かれる', async () => {
        const user = userEvent.setup();
        const onSelectedItemsChange = vi.fn();
        const { rerender } = render(
            <RentalItemsField
                {...defaultProps}
                hasRental="yes"
                selectedItems={[]}
                onSelectedItemsChange={onSelectedItemsChange}
            />,
        );

        await user.click(screen.getByLabelText('フィン'));
        expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['fin']);

        rerender(
            <RentalItemsField
                {...defaultProps}
                hasRental="yes"
                selectedItems={['fin', 'bc']}
                onSelectedItemsChange={onSelectedItemsChange}
            />,
        );

        await user.click(screen.getByLabelText('フィン'));
        expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['bc']);
    });
});
