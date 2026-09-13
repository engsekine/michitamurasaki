import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { Dive } from '@/features/dives/types';

import { DiveDetail } from './DiveDetail';

const baseDive: Dive = {
    id: 'dive-1',
    userId: 'user-1',
    diveNumber: 42,
    diveDate: '2026-04-15',
    entryTime: '09:30:00',
    exitTime: '10:18:00',
    location: '伊豆 / 大瀬崎',
    diveType: 'ファンダイブ',
    weather: '晴れ',
    airTempC: 22,
    waterTempC: 18.2,
    visibilityM: 12,
    wave: '穏やか',
    currentCondition: '弱い',
    maxDepthM: 22.5,
    avgDepthM: 14.8,
    bottomTimeMin: 48,
    tankType: null,
    tankVolumeL: null,
    gasType: null,
    o2Percent: null,
    pressureStartBar: 200,
    pressureEndBar: 60,
    weightKg: 5,
    suitType: 'ウェット 5mm',
    equipmentNotes: null,
    buddyName: null,
    instructorName: null,
    certificationDive: false,
    notes: null,
    isPublic: false,
    publicSlug: null,
    createdAt: '2026-04-15T12:00:00Z',
    updatedAt: '2026-04-15T12:00:00Z',
};

const meta = {
    title: 'features/dives/DiveDetail',
    component: DiveDetail,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof DiveDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { dive: baseDive } };

/** 公開中のログ。SNS 共有ボタン（X / Facebook / Instagram）が表示される（spec 035。閲覧者視点 = canManage なし） */
export const PublicDive: Story = {
    args: { dive: { ...baseDive, isPublic: true } },
};

/** 新月直後の日付（2000-01-07）で「大潮」ラベルが付くケース */
export const SpringTide: Story = {
    args: { dive: { ...baseDive, diveDate: '2000-01-07' } },
};

/** 講習ダイブのバッジ付き */
export const CertificationDive: Story = {
    args: { dive: { ...baseDive, certificationDive: true } },
};

/** 必要 5 項目が揃いエア消費率（15.0 L/分）が表示されるケース */
export const WithSacRate: Story = {
    args: { dive: { ...baseDive, pressureEndBar: 50, tankVolumeL: 10, avgDepthM: 10, bottomTimeMin: 50 } },
};

/** 必要項目が不足し、不足項目の案内が表示されるケース（タンク容量・平均水深が未入力） */
export const SacRateMissing: Story = {
    args: { dive: { ...baseDive, tankVolumeL: null, avgDepthM: null } },
};

/** 開始残圧 = 終了残圧（消費量 0）で、エア消費率も案内も表示しないケース */
export const SacRateHidden: Story = {
    args: { dive: { ...baseDive, pressureStartBar: 100, pressureEndBar: 100, tankVolumeL: 10, avgDepthM: 10 } },
};
