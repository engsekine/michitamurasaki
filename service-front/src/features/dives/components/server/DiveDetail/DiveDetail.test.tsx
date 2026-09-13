import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import type { Dive } from '@/features/dives/types';
import { SITE_NAME, SITE_URL } from '@/shared/constants/site';

import { DiveDetail } from './DiveDetail';

// 削除ボタンは Server Action に依存するためモックする（確認ダイアログの挙動は DeleteDiveButton 側でテスト済み）
vi.mock('@/features/dives/components/client/DeleteDiveButton', () => ({
    DeleteDiveButton: () => <button type="button">削除</button>,
}));

// canManage 時に描画されるクライアント子要素は useRouter / Server Action に依存するためモックする
vi.mock('@/features/dives/components/client/DivePhotoUploader', () => ({
    DivePhotoUploader: () => <div data-testid="dive-photo-uploader" />,
}));

vi.mock('@/features/dives/components/client/DiveVisibilityToggle', () => ({
    DiveVisibilityToggle: () => <div data-testid="dive-visibility-toggle" />,
}));

const baseDive: Dive = {
    id: 'dive-1',
    userId: 'user-1',
    diveNumber: 42,
    diveDate: '2026-04-15',
    entryTime: '09:30:00',
    exitTime: '10:18:00',
    location: '伊豆 / 大瀬崎',
    diveSiteId: null,
    diveShopId: null,
    shop: null,
    diveSite: null,
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

describe('DiveDetail', () => {
    it('location を見出しとして表示する', () => {
        render(<DiveDetail dive={baseDive} />);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('伊豆 / 大瀬崎');
    });

    it('likeAction スロットに渡した要素をヘッダーに描画する（spec 027）', () => {
        render(<DiveDetail dive={baseDive} likeAction={<div data-testid="like-action" />} />);
        expect(screen.getByTestId('like-action')).toBeInTheDocument();
    });

    it('likeAction 未指定でも描画が壊れない', () => {
        render(<DiveDetail dive={baseDive} />);
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('作成者本人(canManage)には単一ログの PDF 出力リンクを表示する', () => {
        render(<DiveDetail dive={baseDive} canManage />);
        expect(screen.getByRole('link', { name: 'PDF出力' })).toHaveAttribute(
            'href',
            '/dives/export?format=pdf&ids=dive-1',
        );
    });

    it('サイト参照ログは見出しのサイト名をサイト詳細へのリンクにする', () => {
        render(
            <DiveDetail
                dive={{ ...baseDive, location: null, diveSite: { id: 'site-9', name: '大瀬崎', area: '伊豆' } }}
            />,
        );
        const link = screen.getByRole('link', { name: '伊豆 / 大瀬崎' });
        expect(link).toHaveAttribute('href', '/dive-sites/site-9');
    });

    it('潜水日を YYYY/MM/DD 形式で表示する', () => {
        render(<DiveDetail dive={baseDive} />);
        expect(screen.getByText('2026/04/15')).toBeInTheDocument();
    });

    it('潜水日に対応する潮回りラベルを表示する', () => {
        // 2000-01-07 は基準朔の翌日 = 大潮（data-model.md 4 節の基準日付）
        render(<DiveDetail dive={{ ...baseDive, diveDate: '2000-01-07' }} />);
        expect(screen.getByText('大潮')).toBeInTheDocument();
    });

    it('日付が不正なときは潮回りラベルを表示しない', () => {
        render(<DiveDetail dive={{ ...baseDive, diveDate: 'invalid' }} />);
        expect(screen.queryByText(/大潮|中潮|小潮|長潮|若潮/)).not.toBeInTheDocument();
    });

    it('必要 5 項目が揃っているときはエア消費率を表示する', () => {
        // 200→50 bar / 10 L / 平均水深 10 m / 50 分 → 15.0 L/分（specs/008 SC-002 の代表値）
        render(
            <DiveDetail
                dive={{ ...baseDive, pressureEndBar: 50, tankVolumeL: 10, avgDepthM: 10, bottomTimeMin: 50 }}
            />,
        );
        expect(screen.getByText('エア消費率')).toBeInTheDocument();
        expect(screen.getByText('15.0 L/分')).toBeInTheDocument();
    });

    it('必要項目が不足しているときは不足項目の案内を表示する', () => {
        // baseDive はタンク容量のみ null
        render(<DiveDetail dive={baseDive} />);
        expect(screen.getByText('タンク容量を入力するとエア消費率が表示されます')).toBeInTheDocument();
    });

    it('複数項目が不足しているときはまとめて案内する', () => {
        render(<DiveDetail dive={{ ...baseDive, tankVolumeL: null, avgDepthM: null }} />);
        expect(screen.getByText('タンク容量・平均水深を入力するとエア消費率が表示されます')).toBeInTheDocument();
    });

    it('開始残圧が終了残圧以下のときはエア消費率も案内も表示しない', () => {
        // 開始 < 終了（防御的ケース。フォームバリデーションでは作成できない）
        const { unmount } = render(
            <DiveDetail
                dive={{ ...baseDive, pressureStartBar: 80, pressureEndBar: 100, tankVolumeL: 10, avgDepthM: 10 }}
            />,
        );
        expect(screen.queryByText(/エア消費率/)).not.toBeInTheDocument();
        unmount();

        // 開始 = 終了（消費量 0）
        render(
            <DiveDetail
                dive={{ ...baseDive, pressureStartBar: 100, pressureEndBar: 100, tankVolumeL: 10, avgDepthM: 10 }}
            />,
        );
        expect(screen.queryByText(/エア消費率/)).not.toBeInTheDocument();
    });

    it('作成者本人(canManage)には編集ページへのリンクを表示する', () => {
        render(<DiveDetail dive={baseDive} canManage />);
        expect(screen.getByRole('link', { name: '編集' })).toHaveAttribute('href', '/dives/dive-1/edit');
    });

    it('作成者以外(canManage=false)には編集・削除・PDF出力を表示しない', () => {
        render(<DiveDetail dive={baseDive} />);
        expect(screen.queryByRole('link', { name: '編集' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'PDF出力' })).not.toBeInTheDocument();
    });

    it('公開ログには SNS 共有ボタンを表示し、共有 URL とテキストを渡す（spec 035 FR-001/006/007）', () => {
        // canManage に依存しない（閲覧者にも表示される）ことを canManage=false で確認する
        render(<DiveDetail dive={{ ...baseDive, isPublic: true }} />);

        const xLink = screen.getByRole('link', { name: 'X で共有' });
        const params = new URL(xLink.getAttribute('href') ?? '').searchParams;
        expect(params.get('url')).toBe(`${SITE_URL}/dives/dive-1`);
        expect(params.get('text')).toBe(`伊豆 / 大瀬崎のダイビングログ（2026/04/15）| ${SITE_NAME}`);
        expect(screen.getByRole('link', { name: 'Facebook で共有' })).toBeInTheDocument();
    });

    it('非公開ログには SNS 共有ボタンを表示しない（spec 035 SC-003）', () => {
        // 所有者（canManage）であっても非公開なら表示しない
        render(<DiveDetail dive={baseDive} canManage />);
        expect(screen.queryByRole('link', { name: 'X で共有' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Facebook で共有' })).not.toBeInTheDocument();
    });

    it('講習ダイブのときはバッジを表示する', () => {
        render(<DiveDetail dive={{ ...baseDive, certificationDive: true }} />);
        expect(screen.getByText('講習ダイブ')).toBeInTheDocument();
    });
});
