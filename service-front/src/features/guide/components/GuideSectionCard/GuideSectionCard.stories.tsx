import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GUIDE_SECTIONS } from '../../constants';
import { GuideSectionCard } from './GuideSectionCard';

const meta = {
    title: 'features/guide/GuideSectionCard',
    component: GuideSectionCard,
    tags: ['autodocs'],
} satisfies Meta<typeof GuideSectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 例示表示なし（テキストのみで手順が完結する・FR-009） */
export const Default: Story = {
    args: {
        section: GUIDE_SECTIONS[0],
    },
};

/** 例示表示あり（app 層から表示専用の実 UI を注入する想定のプレースホルダ） */
export const WithExample: Story = {
    args: {
        section: GUIDE_SECTIONS[1],
        example: (
            <div className="rounded-lg border border-border border-dashed bg-muted/40 p-6 text-center text-muted-foreground text-sm">
                実 UI の例示表示が入ります
            </div>
        ),
    },
};
