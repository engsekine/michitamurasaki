import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Heading } from './Heading';

const meta = {
    title: 'shared/typography/Heading',
    component: Heading,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
    args: {
        children: '見出しテキスト',
    },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** h1: ページタイトル相当。アクセントバーなし・text-3xl font-bold */
export const Level1: Story = {
    args: {
        level: 1,
        children: 'ページタイトル',
    },
};

/** h2: セクション見出し。グラデーションバー付き・text-lg font-semibold */
export const Level2: Story = {
    args: {
        level: 2,
        children: 'セクション見出し',
    },
};

/** h3: サブセクション見出し。小さめのバー付き・text-base font-semibold */
export const Level3: Story = {
    args: {
        level: 3,
        children: 'サブセクション見出し',
    },
};

/** h4: カード内の小見出し。バーなし・text-sm font-medium */
export const Level4: Story = {
    args: {
        level: 4,
        children: '小見出し',
    },
};

/** 3レベルを縦に並べた比較用 story。level ごとのタイポグラフィとバーの差を一覧で確認できる */
export const AllLevels: Story = {
    args: { level: 1 },
    render: () => (
        <div className="flex flex-col gap-6">
            <Heading level={1}>ページタイトル（level 1）</Heading>
            <Heading level={2}>セクション見出し（level 2）</Heading>
            <Heading level={3}>サブセクション見出し（level 3）</Heading>
            <Heading level={4}>小見出し（level 4）</Heading>
        </div>
    ),
};

/** 暗い背景上での白文字上書き例。className="text-white" で文字色を継承から切り替える */
export const OnDarkBackground: Story = {
    args: { level: 1 },
    parameters: {
        layout: 'fullscreen',
    },
    render: () => (
        <div className="flex flex-col gap-6 bg-slate-800 p-10">
            <Heading level={1} className="text-white">
                ページタイトル（level 1）
            </Heading>
            <Heading level={2} className="text-white">
                セクション見出し（level 2）
            </Heading>
            <Heading level={3} className="text-white">
                サブセクション見出し（level 3）
            </Heading>
        </div>
    ),
};
