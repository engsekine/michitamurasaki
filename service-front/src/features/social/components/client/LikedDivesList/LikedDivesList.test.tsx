import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadMoreLikedDives } from '@/features/social/server/actions';
import type { LikedDivesCursor, TimelineItem } from '@/features/social/types';

import { LikedDivesList } from './LikedDivesList';

vi.mock('@/features/social/server/actions', () => ({
    loadMoreLikedDives: vi.fn(),
}));

const mockedLoadMore = vi.mocked(loadMoreLikedDives);

const makeItem = (overrides: Partial<TimelineItem> = {}): TimelineItem => ({
    diveId: 'dive-1',
    diveDate: '2026-06-01',
    location: '慶良間諸島',
    maxDepthM: 25,
    bottomTimeMin: 50,
    ownerId: 'user-1',
    ownerNickname: 'taro',
    ownerHandle: 'taro',
    likeCount: 3,
    likedByMe: true,
    ...overrides,
});

const CURSOR: LikedDivesCursor = { likedAt: '2026-06-01T10:00:00Z', diveId: 'dive-1' };

describe('LikedDivesList', () => {
    beforeEach(() => {
        mockedLoadMore.mockReset();
    });

    describe('空状態', () => {
        it('initialItems が空配列のとき「いいねしたログはありません」を表示する', () => {
            render(<LikedDivesList initialItems={[]} initialCursor={null} />);

            expect(screen.getByText(/いいねしたログはありません/)).toBeInTheDocument();
        });

        it('空状態のときリストや「さらに読み込む」ボタンを表示しない', () => {
            render(<LikedDivesList initialItems={[]} initialCursor={null} />);

            expect(screen.queryByRole('list')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'さらに読み込む' })).not.toBeInTheDocument();
        });
    });

    describe('初期表示（アイテムあり）', () => {
        it('location が /dives/{diveId} へのリンクになっている', () => {
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={null} />);

            const link = screen.getByRole('link', { name: '慶良間諸島' });
            expect(link).toHaveAttribute('href', '/dives/dive-1');
        });

        it('ownerNickname の表示リンクがユーザー ID の URL になっている（034 / FR-004）', () => {
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={null} />);

            const link = screen.getByRole('link', { name: 'taro' });
            expect(link).toHaveAttribute('href', '/users/taro');
        });

        it('「いいね {n} 件」の件数表示がある（スクリーンリーダー向けテキスト）', () => {
            render(<LikedDivesList initialItems={[makeItem({ likeCount: 7 })]} initialCursor={null} />);

            expect(screen.getByText('いいね 7 件')).toBeInTheDocument();
        });

        it('複数アイテムを全て描画する', () => {
            const items = [
                makeItem({
                    diveId: 'dive-1',
                    location: '慶良間諸島',
                    ownerId: 'user-1',
                    ownerNickname: 'taro',
                    ownerHandle: 'taro',
                }),
                makeItem({ diveId: 'dive-2', location: '柏島', ownerId: 'user-2', ownerNickname: 'hanako' }),
            ];
            render(<LikedDivesList initialItems={items} initialCursor={null} />);

            expect(screen.getByRole('link', { name: '慶良間諸島' })).toBeInTheDocument();
            expect(screen.getByRole('link', { name: '柏島' })).toBeInTheDocument();
        });
    });

    describe('「さらに読み込む」ボタンの表示制御', () => {
        it('initialCursor が null のときボタンを表示しない', () => {
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={null} />);

            expect(screen.queryByRole('button', { name: 'さらに読み込む' })).not.toBeInTheDocument();
        });

        it('initialCursor があるときボタンを表示する', () => {
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={CURSOR} />);

            expect(screen.getByRole('button', { name: 'さらに読み込む' })).toBeInTheDocument();
        });
    });

    describe('追加読み込み（成功）', () => {
        it('ボタンクリックで loadMoreLikedDives を cursor を渡して呼ぶ', async () => {
            mockedLoadMore.mockResolvedValue({ items: [], nextCursor: null });
            const user = userEvent.setup();
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={CURSOR} />);

            await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));

            expect(mockedLoadMore).toHaveBeenCalledWith(CURSOR);
        });

        it('取得した items が既存リストの末尾に追加される', async () => {
            const newItem = makeItem({
                diveId: 'dive-2',
                location: '柏島',
                ownerId: 'user-2',
                ownerNickname: 'hanako',
            });
            mockedLoadMore.mockResolvedValue({ items: [newItem], nextCursor: null });
            const user = userEvent.setup();
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={CURSOR} />);

            await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));

            await waitFor(() => expect(screen.getByRole('link', { name: '柏島' })).toBeInTheDocument());
            // 元のアイテムも残っている
            expect(screen.getByRole('link', { name: '慶良間諸島' })).toBeInTheDocument();
        });

        it('nextCursor が null を返したらボタンが消える', async () => {
            mockedLoadMore.mockResolvedValue({ items: [], nextCursor: null });
            const user = userEvent.setup();
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={CURSOR} />);

            await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));

            await waitFor(() =>
                expect(screen.queryByRole('button', { name: 'さらに読み込む' })).not.toBeInTheDocument(),
            );
        });

        it('nextCursor が返ってきたらボタンが引き続き表示される', async () => {
            const nextCursor: LikedDivesCursor = { likedAt: '2026-05-01T10:00:00Z', diveId: 'dive-9' };
            mockedLoadMore.mockResolvedValue({ items: [], nextCursor });
            const user = userEvent.setup();
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={CURSOR} />);

            await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));

            await waitFor(() => expect(screen.getByRole('button', { name: 'さらに読み込む' })).toBeInTheDocument());
        });
    });

    describe('読み込み中の UI', () => {
        it('読み込み中はボタンのテキストが「読み込み中...」になり disabled になる', async () => {
            let resolve!: (value: { items: TimelineItem[]; nextCursor: LikedDivesCursor | null }) => void;
            mockedLoadMore.mockReturnValue(
                new Promise((r) => {
                    resolve = r;
                }),
            );
            const user = userEvent.setup();
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={CURSOR} />);

            await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));

            const btn = screen.getByRole('button', { name: '読み込み中...' });
            expect(btn).toBeDisabled();
            expect(btn).toHaveAttribute('aria-busy', 'true');

            resolve({ items: [], nextCursor: null });
            await waitFor(() =>
                expect(screen.queryByRole('button', { name: '読み込み中...' })).not.toBeInTheDocument(),
            );
        });
    });

    describe('追加読み込み（失敗）', () => {
        it('loadMoreLikedDives が reject したら role="alert" にエラーメッセージを表示する', async () => {
            mockedLoadMore.mockRejectedValue(new Error('network error'));
            const user = userEvent.setup();
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={CURSOR} />);

            await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));

            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(
                    '読み込みに失敗しました。時間をおいて再度お試しください',
                ),
            );
        });

        it('失敗してもそれまでの items は残る', async () => {
            mockedLoadMore.mockRejectedValue(new Error('network error'));
            const user = userEvent.setup();
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={CURSOR} />);

            await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));

            await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
            expect(screen.getByRole('link', { name: '慶良間諸島' })).toBeInTheDocument();
        });

        it('再試行でエラーが消える', async () => {
            mockedLoadMore
                .mockRejectedValueOnce(new Error('network error'))
                .mockResolvedValueOnce({ items: [], nextCursor: null });

            const user = userEvent.setup();
            render(<LikedDivesList initialItems={[makeItem()]} initialCursor={CURSOR} />);

            // 1回目: 失敗
            await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));
            await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

            // 2回目: 成功 → エラー消える
            await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));
            await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        });
    });
});
