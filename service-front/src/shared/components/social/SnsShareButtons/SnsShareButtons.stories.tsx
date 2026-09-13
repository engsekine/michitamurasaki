import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SnsShareButtons } from './SnsShareButtons';

const meta = {
    title: 'shared/social/SnsShareButtons',
    component: SnsShareButtons,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
    args: {
        url: 'http://localhost:3000/dives/d1',
        text: '伊豆 / 大瀬崎のダイビングログ（2026/04/15）| divlog',
    },
} satisfies Meta<typeof SnsShareButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 既定表示。X / Facebook のブランドアイコン付き共有アンカーを横並びで表示する。
 * どちらも共有インテント URL を新しいタブで開くだけの静的リンク（状態を持たない）。
 * Instagram は Web 共有インテント非対応のため提供しない（2026-07-16 改定）。
 */
export const Default: Story = {};
