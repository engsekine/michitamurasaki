import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DeleteShopButton } from './DeleteShopButton';

const meta = {
    title: 'features/shops/DeleteShopButton',
    component: DeleteShopButton,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof DeleteShopButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { shopId: 'sample-shop-id' },
};
