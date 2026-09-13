import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { DiveBuddyField } from './DiveBuddyField';

const meta = {
    title: 'features/dives/DiveBuddyField',
    component: DiveBuddyField,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
    args: { onChange: fn() },
} satisfies Meta<typeof DiveBuddyField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
    args: { value: [] },
};

export const WithFreetextBuddies: Story = {
    args: { value: [{ name: '海太郎' }, { name: '山子' }] },
};

export const WithRegisteredBuddy: Story = {
    args: { value: [{ userId: '123e4567-e89b-12d3-a456-426614174000' }, { name: '海太郎' }] },
};

export const WithError: Story = {
    args: { value: [{ name: '' }], error: 'バディは登録ユーザーか名前のどちらか一方を指定してください' },
};
