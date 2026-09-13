import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GuideIntroSection } from './GuideIntroSection';

const meta = {
    title: 'features/guide/GuideIntroSection',
    component: GuideIntroSection,
    tags: ['autodocs'],
} satisfies Meta<typeof GuideIntroSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
