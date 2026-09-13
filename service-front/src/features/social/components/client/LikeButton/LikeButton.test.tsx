import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { likeDive, unlikeDive } from '@/features/social/server/actions';

import { LikeButton } from './LikeButton';

vi.mock('@/features/social/server/actions', () => ({
    likeDive: vi.fn(),
    unlikeDive: vi.fn(),
}));

const mockedLike = vi.mocked(likeDive);
const mockedUnlike = vi.mocked(unlikeDive);

describe('LikeButton', () => {
    beforeEach(() => {
        mockedLike.mockReset();
        mockedUnlike.mockReset();
    });

    describe('初期表示', () => {
        it('未いいね時は件数と aria-pressed=false を表示する', () => {
            render(<LikeButton diveId="dive1" initialIsLiked={false} initialCount={3} />);

            const button = screen.getByRole('button', { name: 'いいね 3 件' });
            expect(button).toHaveAttribute('aria-pressed', 'false');
            expect(button).toHaveTextContent('3');
        });

        it('いいね済み時は件数と aria-pressed=true、ラベルに「いいね済み」を表示する', () => {
            render(<LikeButton diveId="dive1" initialIsLiked={true} initialCount={5} />);

            const button = screen.getByRole('button', { name: 'いいね 5 件、いいね済み' });
            expect(button).toHaveAttribute('aria-pressed', 'true');
            expect(button).toHaveTextContent('5');
        });

        it('件数が 0 件のときも正しく表示する', () => {
            render(<LikeButton diveId="dive1" initialIsLiked={false} initialCount={0} />);

            const button = screen.getByRole('button', { name: 'いいね 0 件' });
            expect(button).toHaveAttribute('aria-pressed', 'false');
            expect(button).toHaveTextContent('0');
        });

        it('初期表示時はエラーメッセージを表示しない', () => {
            render(<LikeButton diveId="dive1" initialIsLiked={false} initialCount={3} />);

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('いいね操作（楽観的 UI）', () => {
        it('クリックで件数が即座に +1 になり likeDive を呼ぶ', async () => {
            mockedLike.mockResolvedValue({ success: true, isLiked: true });
            const user = userEvent.setup();
            render(<LikeButton diveId="dive1" initialIsLiked={false} initialCount={3} />);

            await user.click(screen.getByRole('button', { name: 'いいね 3 件' }));

            // 楽観的に +1 されている
            expect(screen.getByRole('button', { name: 'いいね 4 件、いいね済み' })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
            expect(mockedLike).toHaveBeenCalledWith('dive1');
            expect(mockedUnlike).not.toHaveBeenCalled();
        });

        it('いいね取り消し時は件数が即座に -1 になり unlikeDive を呼ぶ', async () => {
            mockedUnlike.mockResolvedValue({ success: true, isLiked: false });
            const user = userEvent.setup();
            render(<LikeButton diveId="dive1" initialIsLiked={true} initialCount={5} />);

            await user.click(screen.getByRole('button', { name: 'いいね 5 件、いいね済み' }));

            expect(screen.getByRole('button', { name: 'いいね 4 件' })).toHaveAttribute('aria-pressed', 'false');
            expect(mockedUnlike).toHaveBeenCalledWith('dive1');
            expect(mockedLike).not.toHaveBeenCalled();
        });

        it('件数が 1 のときいいね取り消しをしても 0 未満にならない', async () => {
            mockedUnlike.mockResolvedValue({ success: true, isLiked: false });
            const user = userEvent.setup();
            render(<LikeButton diveId="dive1" initialIsLiked={true} initialCount={1} />);

            await user.click(screen.getByRole('button', { name: 'いいね 1 件、いいね済み' }));

            expect(screen.getByRole('button', { name: 'いいね 0 件' })).toHaveTextContent('0');
        });

        it('Action 完了後も isLiked が result の値で確定する', async () => {
            mockedLike.mockResolvedValue({ success: true, isLiked: true });
            const user = userEvent.setup();
            render(<LikeButton diveId="dive1" initialIsLiked={false} initialCount={3} />);

            await user.click(screen.getByRole('button', { name: 'いいね 3 件' }));

            await waitFor(() =>
                expect(screen.getByRole('button', { name: 'いいね 4 件、いいね済み' })).toHaveAttribute(
                    'aria-pressed',
                    'true',
                ),
            );
        });
    });

    describe('失敗時のロールバック', () => {
        it('likeDive 失敗時は状態をロールバックし role="alert" にエラーを表示する', async () => {
            mockedLike.mockResolvedValue({ success: false, error: 'いいねに失敗しました' });
            const user = userEvent.setup();
            render(<LikeButton diveId="dive1" initialIsLiked={false} initialCount={3} />);

            await user.click(screen.getByRole('button', { name: 'いいね 3 件' }));

            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('いいねに失敗しました'));
            // ロールバックされて元の状態に戻る
            expect(screen.getByRole('button', { name: 'いいね 3 件' })).toHaveAttribute('aria-pressed', 'false');
        });

        it('unlikeDive 失敗時は状態をロールバックし role="alert" にエラーを表示する', async () => {
            mockedUnlike.mockResolvedValue({ success: false, error: 'いいね取り消しに失敗しました' });
            const user = userEvent.setup();
            render(<LikeButton diveId="dive1" initialIsLiked={true} initialCount={5} />);

            await user.click(screen.getByRole('button', { name: 'いいね 5 件、いいね済み' }));

            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('いいね取り消しに失敗しました'));
            // ロールバックされて元の状態に戻る
            expect(screen.getByRole('button', { name: 'いいね 5 件、いいね済み' })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
        });

        it('成功後に再クリックして失敗した場合、ロールバックで直前の状態に戻る', async () => {
            mockedLike.mockResolvedValueOnce({ success: true, isLiked: true });
            mockedUnlike.mockResolvedValue({ success: false, error: '取り消しに失敗しました' });

            const user = userEvent.setup();
            render(<LikeButton diveId="dive1" initialIsLiked={false} initialCount={3} />);

            // 1回目は成功
            await user.click(screen.getByRole('button', { name: 'いいね 3 件' }));
            await waitFor(() =>
                expect(screen.getByRole('button', { name: 'いいね 4 件、いいね済み' })).toBeInTheDocument(),
            );

            // 2回目（取り消し）は失敗 → ロールバック + エラー
            await user.click(screen.getByRole('button', { name: 'いいね 4 件、いいね済み' }));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('取り消しに失敗しました'));
            // ロールバックでいいね済み状態に戻る
            expect(screen.getByRole('button', { name: 'いいね 4 件、いいね済み' })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
        });
    });

    describe('isPending 中の連打抑止', () => {
        it('Action が解決する前に再クリックしても likeDive は 1 回しか呼ばれない', async () => {
            let resolveAction!: (value: { success: true; isLiked: true }) => void;
            mockedLike.mockReturnValue(
                new Promise<{ success: true; isLiked: true }>((resolve) => {
                    resolveAction = resolve;
                }),
            );
            const user = userEvent.setup();
            render(<LikeButton diveId="dive1" initialIsLiked={false} initialCount={3} />);

            // 1回目クリック（Pending になる）
            await user.click(screen.getByRole('button', { name: 'いいね 3 件' }));

            // Pending 中に 2 回目クリック → 連打抑止で無視される
            await user.click(screen.getByRole('button', { name: 'いいね 4 件、いいね済み' }));

            // Action を解決
            resolveAction({ success: true, isLiked: true });
            await waitFor(() => expect(mockedLike).toHaveBeenCalledTimes(1));
        });
    });

    describe('a11y 属性', () => {
        it('Action 実行中は aria-busy=true になる', async () => {
            let resolveAction!: (value: { success: true; isLiked: true }) => void;
            mockedLike.mockReturnValue(
                new Promise<{ success: true; isLiked: true }>((resolve) => {
                    resolveAction = resolve;
                }),
            );
            const user = userEvent.setup();
            render(<LikeButton diveId="dive1" initialIsLiked={false} initialCount={3} />);

            await user.click(screen.getByRole('button', { name: 'いいね 3 件' }));

            // startTransition 内の非同期が解決する前は aria-busy=true
            expect(screen.getByRole('button', { name: 'いいね 4 件、いいね済み' })).toHaveAttribute(
                'aria-busy',
                'true',
            );

            resolveAction({ success: true, isLiked: true });
            await waitFor(() =>
                expect(screen.getByRole('button', { name: 'いいね 4 件、いいね済み' })).toHaveAttribute(
                    'aria-busy',
                    'false',
                ),
            );
        });
    });
});
