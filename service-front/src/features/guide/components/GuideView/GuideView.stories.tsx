import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GuideView } from './GuideView';

const meta = {
    title: 'features/guide/GuideView',
    component: GuideView,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
} satisfies Meta<typeof GuideView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 例示表示あり（app 層から注入する想定のプレースホルダ） */
export const WithExamples: Story = {
    args: {
        examples: {
            'dive-logs': (
                <div className="rounded-lg border border-border border-dashed bg-muted/40 p-6 text-center text-muted-foreground text-sm">
                    ログカードの例示表示が入ります
                </div>
            ),
        },
    },
};
