import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationItem } from '@/features/notifications/server/queries';

const markNotificationRead = vi.fn();
const routerPush = vi.fn();

vi.mock('@/features/notifications/server/actions', () => ({
    markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}));

import { NotificationBellPanel } from './NotificationBellPanel';

// buildItem: テストごとに必要なフィールドだけ上書きできる最小ファクトリ
const buildItem = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
    id: 'n1',
    type: 'followed',
    actorId: 'user-1',
    actorNickname: 'たろう',
    actorHandle: 'taro',
    resourceId: null,
    occurredAt: '2026-07-01T12:00:00+09:00',
    readAt: null,
    ...overrides,
});

// シートを開くヘルパー
const openSheet = async (buttonName: string | RegExp) => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: buttonName }));
    return { user, sheet: await screen.findByRole('dialog', { name: '通知' }) };
};

describe('NotificationBellPanel', () => {
    beforeEach(() => {
        markNotificationRead.mockReset();
        routerPush.mockReset();
    });

    describe('未読バッジと aria-label', () => {
        it('未読 0 件のとき aria-label は「通知」でバッジを表示しない', () => {
            render(<NotificationBellPanel unreadCount={0} items={[]} />);

            const button = screen.getByRole('button', { name: '通知' });
            expect(button).not.toHaveTextContent(/\d/);
        });

        it('未読 1 件のとき aria-label に件数を含め、バッジに「1」を表示する', () => {
            render(<NotificationBellPanel unreadCount={1} items={[]} />);

            expect(screen.getByRole('button', { name: '通知（未読 1 件）' })).toHaveTextContent('1');
        });

        it('未読 9 件（上限ぴったり）はバッジに「9」を表示する', () => {
            render(<NotificationBellPanel unreadCount={9} items={[]} />);

            expect(screen.getByRole('button', { name: '通知（未読 9 件）' })).toHaveTextContent('9');
        });

        it('未読 10 件（上限超え）はバッジを「9+」に丸め、aria-label には実件数を使う', () => {
            render(<NotificationBellPanel unreadCount={10} items={[]} />);

            expect(screen.getByRole('button', { name: '通知（未読 10 件）' })).toHaveTextContent('9+');
        });
    });

    describe('シートの開閉', () => {
        it('ベルを押すとシート（dialog・title「通知」）が開き、/notifications への導線がある', async () => {
            render(<NotificationBellPanel unreadCount={0} items={[]} />);

            const { sheet } = await openSheet('通知');
            expect(within(sheet).getByRole('link', { name: 'すべての通知を見る' })).toHaveAttribute(
                'href',
                '/notifications',
            );
        });

        it('「すべての通知を見る」をクリックするとシートが閉じる', async () => {
            render(<NotificationBellPanel unreadCount={0} items={[]} />);

            const { user, sheet } = await openSheet('通知');
            await user.click(within(sheet).getByRole('link', { name: 'すべての通知を見る' }));

            expect(screen.queryByRole('dialog', { name: '通知' })).not.toBeInTheDocument();
        });
    });

    describe('通知 0 件', () => {
        it('items が空のとき「通知はありません」を表示しリストを出さない', async () => {
            render(<NotificationBellPanel unreadCount={0} items={[]} />);

            const { sheet } = await openSheet('通知');
            expect(within(sheet).getByText('通知はありません')).toBeInTheDocument();
            expect(within(sheet).queryByRole('list')).not.toBeInTheDocument();
        });
    });

    describe('通知リストの表示', () => {
        it('未読の通知に「未読」バッジ、既読には出さない', async () => {
            const items = [
                buildItem({ id: 'n1', readAt: null }),
                buildItem({ id: 'n2', actorNickname: 'じろう', readAt: '2026-07-01T13:00:00+09:00' }),
            ];
            render(<NotificationBellPanel unreadCount={1} items={items} />);

            const { sheet } = await openSheet('通知（未読 1 件）');
            expect(within(sheet).getAllByText('未読')).toHaveLength(1);
        });

        it('メッセージにニックネーム、日付は JST の YYYY/MM/DD で表示する', async () => {
            const item = buildItem({ actorNickname: 'はなこ', occurredAt: '2026-07-01T12:00:00+09:00' });
            render(<NotificationBellPanel unreadCount={1} items={[item]} />);

            const { sheet } = await openSheet('通知（未読 1 件）');
            expect(within(sheet).getByText(/はなこ/)).toBeInTheDocument();
            expect(within(sheet).getByText('2026/07/01')).toBeInTheDocument();
        });
    });

    describe('クリッカブル / 非クリッカブルの判定', () => {
        it('href が解決できる followed 通知はボタンとして表示する', async () => {
            const item = buildItem({ type: 'followed', actorId: 'user-1', actorNickname: 'たろう' });
            render(<NotificationBellPanel unreadCount={1} items={[item]} />);

            const { sheet } = await openSheet('通知（未読 1 件）');
            expect(within(sheet).getByRole('button', { name: /たろう/ })).toBeInTheDocument();
        });

        it('followed かつ actor 退会（nickname null）は非クリッカブルでテキストのみ表示する', async () => {
            const item = buildItem({ type: 'followed', actorId: null, actorNickname: null });
            render(<NotificationBellPanel unreadCount={1} items={[item]} />);

            const { sheet } = await openSheet('通知（未読 1 件）');
            expect(within(sheet).queryByRole('button', { name: /退会したユーザー/ })).not.toBeInTheDocument();
            expect(within(sheet).getByText(/退会したユーザー/)).toBeInTheDocument();
        });
    });

    describe('通知タップ時の既読化と遷移', () => {
        it('タップすると markNotificationRead → シートを閉じて遷移先へ移動する', async () => {
            markNotificationRead.mockResolvedValue({ success: true });
            const item = buildItem({
                id: 'n9',
                type: 'followed',
                actorId: 'user-9',
                actorNickname: 'きろう',
                actorHandle: 'kiro',
            });
            render(<NotificationBellPanel unreadCount={1} items={[item]} />);

            const { user, sheet } = await openSheet('通知（未読 1 件）');
            await user.click(within(sheet).getByRole('button', { name: /きろう/ }));

            expect(markNotificationRead).toHaveBeenCalledWith('n9');
            // 034: 遷移先はユーザー ID の URL になる
            expect(routerPush).toHaveBeenCalledWith('/users/kiro');
            expect(screen.queryByRole('dialog', { name: '通知' })).not.toBeInTheDocument();
        });

        it('既読化が失敗（reject）しても遷移とシート閉鎖は行う', async () => {
            markNotificationRead.mockRejectedValue(new Error('network error'));
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const item = buildItem({ id: 'n-fail', type: 'followed', actorId: 'user-1', actorNickname: 'たろう' });
            render(<NotificationBellPanel unreadCount={1} items={[item]} />);

            const { user, sheet } = await openSheet('通知（未読 1 件）');
            await user.click(within(sheet).getByRole('button', { name: /たろう/ }));

            expect(routerPush).toHaveBeenCalledWith('/users/taro');
            expect(screen.queryByRole('dialog', { name: '通知' })).not.toBeInTheDocument();
            consoleError.mockRestore();
        });
    });
});
