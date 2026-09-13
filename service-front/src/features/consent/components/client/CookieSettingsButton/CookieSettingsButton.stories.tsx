import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CookieSettingsButton } from './CookieSettingsButton';

const meta = {
    title: 'features/consent/CookieSettingsButton',
    component: CookieSettingsButton,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
} satisfies Meta<typeof CookieSettingsButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
