import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TimelineItem } from '@/features/social/types';
import { Timeline } from './Timeline';

// LikeButton が import する Server Action をモック（描画のみで呼ばれない）
vi.mock('@/features/social/server/actions', () => ({
    likeDive: vi.fn(),
    unlikeDive: vi.fn(),
}));

const item = (id: string, diveDate: string): TimelineItem => ({
    diveId: id,
    diveDate,
    location: `ポイント${id}`,
    maxDepthM: 18,
    bottomTimeMin: 40,
    ownerId: `owner-${id}`,
    ownerNickname: `ニック${id}`,
    ownerHandle: `handle-${id}`,
    likeCount: 0,
    likedByMe: false,
});

describe('Timeline', () => {
    it('空のときはフォローを促す空状態を表示する', () => {
        render(<Timeline items={[]} />);
        expect(screen.getByText(/フォローしてみましょう/)).toBeInTheDocument();
    });

    it('公開ログを日付見出し付きで表示し、詳細へのリンクを張る', () => {
        render(<Timeline items={[item('1', '2026-06-30'), item('2', '2026-06-29')]} />);
        expect(screen.getByText('2026/06/30')).toBeInTheDocument();
        expect(screen.getByText('2026/06/29')).toBeInTheDocument();
        const link = screen.getByRole('link', { name: /ポイント1/ });
        expect(link).toHaveAttribute('href', '/dives/1');
    });

    it('所有者の nickname はプロフィールへリンクし、深度・時間も表示する', () => {
        render(<Timeline items={[item('1', '2026-06-30')]} />);
        const ownerLink = screen.getByRole('link', { name: 'ニック1' });
        // 034: プロフィールリンクはユーザー ID の URL になる
        expect(ownerLink).toHaveAttribute('href', '/users/handle-1');
        expect(screen.getByText(/最大 18m ・ 40分/, { selector: 'span' })).toBeInTheDocument();
    });

    it('閲覧者がいれば他人のログにいいねボタン（件数・状態付き）を表示する', () => {
        const liked = { ...item('1', '2026-06-30'), likeCount: 3, likedByMe: true };
        render(<Timeline items={[liked]} viewerId="viewer-1" />);
        const button = screen.getByRole('button', { name: 'いいね 3 件、いいね済み' });
        expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('自分のログにはいいねボタンを出さず件数のみ表示する', () => {
        const mine = { ...item('1', '2026-06-30'), likeCount: 2 };
        render(<Timeline items={[mine]} viewerId="owner-1" />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByText('いいね 2 件')).toBeInTheDocument();
    });

    it('viewerId 未指定なら操作ボタンを出さず件数のみ表示する', () => {
        render(<Timeline items={[item('1', '2026-06-30')]} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByText('いいね 0 件')).toBeInTheDocument();
    });
});
