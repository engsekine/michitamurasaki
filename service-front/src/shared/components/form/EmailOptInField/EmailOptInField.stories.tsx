import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { EmailOptInField } from './EmailOptInField';

const meta = {
    title: 'shared/form/EmailOptInField',
    component: EmailOptInField,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
    args: {
        id: 'emailOptIn',
    },
} satisfies Meta<typeof EmailOptInField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
    args: { defaultChecked: true },
};

export const WithError: Story = {
    args: { error: 'エラーが発生しました' },
};
