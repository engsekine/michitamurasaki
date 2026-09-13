import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { UpdatePasswordForm } from './UpdatePasswordForm';

const meta = {
    title: 'features/auth/UpdatePasswordForm',
    component: UpdatePasswordForm,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    },
} satisfies Meta<typeof UpdatePasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
