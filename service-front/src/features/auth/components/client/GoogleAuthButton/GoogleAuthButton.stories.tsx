import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GoogleAuthButton } from './GoogleAuthButton';

const meta = {
    title: 'features/auth/GoogleAuthButton',
    component: GoogleAuthButton,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
} satisfies Meta<typeof GoogleAuthButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Login: Story = {};

export const Signup: Story = {
    args: {
        label: 'Google で続行',
    },
};
