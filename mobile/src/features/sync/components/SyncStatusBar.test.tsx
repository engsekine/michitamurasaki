import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import type { SyncProgress } from '../engine';
import { SyncStatusBar } from './SyncStatusBar';

const idle = (lastError: string | null = null): SyncProgress => ({ phase: 'idle', total: 0, done: 0, lastError });

describe('SyncStatusBar', () => {
    it('未転送が 0 件なら何も表示しない', async () => {
        const view = await render(
            <SyncStatusBar pendingCount={0} failedCount={0} progress={idle()} onRetry={jest.fn()} />,
        );

        expect(view.queryByText(/転送/)).toBeNull();
    });

    it('転送待ち件数を表示する（FR-003）', async () => {
        const view = await render(
            <SyncStatusBar pendingCount={3} failedCount={0} progress={idle()} onRetry={jest.fn()} />,
        );

        expect(view.getByText('転送待ち 3 件（通信回復後に自動転送されます）')).toBeTruthy();
    });

    it('転送中は進捗を表示する（SC-005）', async () => {
        const view = await render(
            <SyncStatusBar
                pendingCount={5}
                failedCount={0}
                progress={{ phase: 'running', total: 5, done: 2, lastError: null }}
                onRetry={jest.fn()}
            />,
        );

        expect(view.getByText('転送中... 2 / 5 件')).toBeTruthy();
    });

    it('失敗があるときは再転送ボタンを表示し、押すと onRetry が呼ばれる（FR-006）', async () => {
        const onRetry = jest.fn();
        const view = await render(
            <SyncStatusBar pendingCount={2} failedCount={1} progress={idle('x')} onRetry={onRetry} />,
        );

        expect(view.getByText('転送待ち 2 件（うち失敗 1 件）')).toBeTruthy();
        await fireEvent.press(view.getByRole('button', { name: '失敗したログを再転送' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('セッション失効時は再ログインが必要な旨を表示する（FR-020）', async () => {
        const view = await render(
            <SyncStatusBar
                pendingCount={2}
                failedCount={0}
                progress={{ phase: 'auth-required', total: 0, done: 0, lastError: null }}
                onRetry={jest.fn()}
            />,
        );

        expect(view.getByText('転送待ち 2 件（転送には再ログインが必要です）')).toBeTruthy();
    });
});
