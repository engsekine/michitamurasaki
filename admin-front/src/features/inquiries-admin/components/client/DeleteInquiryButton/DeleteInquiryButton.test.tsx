import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { deleteInquiry } = vi.hoisted(() => ({ deleteInquiry: vi.fn() }));
vi.mock('@/features/inquiries-admin/server/actions', () => ({ deleteInquiry }));

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

import { DeleteInquiryButton } from './DeleteInquiryButton';

describe('DeleteInquiryButton', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('削除→確認で deleteInquiry を呼び、成功時は一覧へ戻る', async () => {
        deleteInquiry.mockResolvedValue({ success: true });
        render(<DeleteInquiryButton id="abc" />);

        fireEvent.click(screen.getByRole('button', { name: '削除' }));
        fireEvent.click(await screen.findByRole('button', { name: '削除する' }));

        await waitFor(() => expect(deleteInquiry).toHaveBeenCalledWith('abc'));
        await waitFor(() => expect(push).toHaveBeenCalledWith('/inquiries'));
    });

    it('削除失敗時は alert でエラーを表示する', async () => {
        deleteInquiry.mockResolvedValue({ success: false, error: '処理に失敗しました' });
        render(<DeleteInquiryButton id="abc" />);

        fireEvent.click(screen.getByRole('button', { name: '削除' }));
        fireEvent.click(await screen.findByRole('button', { name: '削除する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('処理に失敗しました');
    });
});
