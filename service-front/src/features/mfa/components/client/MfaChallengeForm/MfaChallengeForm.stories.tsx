import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { MfaChallengeForm } from './MfaChallengeForm';

const meta = {
    title: 'features/mfa/MfaChallengeForm',
    component: MfaChallengeForm,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
    args: { factorId: 'factor-1' },
} satisfies Meta<typeof MfaChallengeForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
