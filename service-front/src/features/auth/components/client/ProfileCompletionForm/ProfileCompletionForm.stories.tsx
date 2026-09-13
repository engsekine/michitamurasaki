import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProfileCompletionForm } from './ProfileCompletionForm';

const meta = {
    title: 'features/auth/ProfileCompletionForm',
    component: ProfileCompletionForm,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
} satisfies Meta<typeof ProfileCompletionForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
