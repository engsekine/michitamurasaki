import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { RentalItemsField } from './RentalItemsField';

const meta = {
    title: 'features/application-sheet/RentalItemsField',
    component: RentalItemsField,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
    args: {
        onHasRentalChange: fn(),
        onSelectedItemsChange: fn(),
        onOmitRentalBlockChange: fn(),
    },
} satisfies Meta<typeof RentalItemsField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {
    args: {
        hasRental: '',
        selectedItems: [],
        omitRentalBlock: false,
    },
};

export const RentalYes: Story = {
    args: {
        hasRental: 'yes',
        selectedItems: ['wetSuitFullSet', 'fin'],
        omitRentalBlock: false,
    },
};

export const RentalNoWithOmitToggle: Story = {
    args: {
        hasRental: 'no',
        selectedItems: [],
        omitRentalBlock: true,
    },
};
