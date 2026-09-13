import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { SheetPreview } from './SheetPreview';

const SAMPLE_TEXT = '・お名前（山田 太郎）\n・年齢（36 歳）';

describe('SheetPreview', () => {
    it('textarea に生成テキストの全文が表示される', () => {
        render(<SheetPreview generatedText={SAMPLE_TEXT} />);

        expect(screen.getByLabelText('生成テキスト')).toHaveValue(SAMPLE_TEXT);
    });

    it('コピーボタン押下で clipboard に全文が渡り、role="status" で完了が通知される', async () => {
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, 'writeText');
        render(<SheetPreview generatedText={SAMPLE_TEXT} />);

        await user.click(screen.getByRole('button', { name: 'コピーする' }));

        expect(writeText).toHaveBeenCalledWith(SAMPLE_TEXT);
        expect(screen.getByText('コピーしました').closest('[role="status"]')).not.toBeNull();
    });

    it('clipboard が使えない環境でもテキストは選択可能なまま案内が出る', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard unavailable')) },
            configurable: true,
        });
        render(<SheetPreview generatedText={SAMPLE_TEXT} />);

        fireEvent.click(screen.getByRole('button', { name: 'コピーする' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'コピーできませんでした。テキストを選択して手動でコピーしてください',
        );
        expect(screen.getByLabelText('生成テキスト')).toHaveValue(SAMPLE_TEXT);
    });

    describe('直接編集', () => {
        it('textarea を直接編集できる', async () => {
            const user = userEvent.setup();
            render(<SheetPreview generatedText={SAMPLE_TEXT} />);

            const textarea = screen.getByLabelText('生成テキスト');
            await user.click(textarea);
            await user.keyboard('{Control>}a{/Control}追記メモ');

            expect(textarea).toHaveValue('追記メモ');
        });

        it('編集後はフォーム由来の再生成で上書きされず、編集中の案内が出る', async () => {
            const user = userEvent.setup();
            const { rerender } = render(<SheetPreview generatedText={SAMPLE_TEXT} />);

            const textarea = screen.getByLabelText('生成テキスト');
            await user.click(textarea);
            await user.keyboard('{Control>}a{/Control}編集済みテキスト');

            // フォーム変更で generatedText が変わっても編集内容を保持する
            rerender(<SheetPreview generatedText={'・お名前（佐藤 花子）'} />);

            expect(textarea).toHaveValue('編集済みテキスト');
            expect(screen.getByText(/手動編集中/)).toBeInTheDocument();
        });

        it('未編集のときはフォーム由来の再生成が反映され、編集中の案内は出ない', () => {
            const { rerender } = render(<SheetPreview generatedText={SAMPLE_TEXT} />);

            rerender(<SheetPreview generatedText={'・お名前（佐藤 花子）'} />);

            expect(screen.getByLabelText('生成テキスト')).toHaveValue('・お名前（佐藤 花子）');
            expect(screen.queryByText(/手動編集中/)).not.toBeInTheDocument();
        });

        it('「フォームの内容から再生成」で編集を破棄して生成テキストに戻る', async () => {
            const user = userEvent.setup();
            render(<SheetPreview generatedText={SAMPLE_TEXT} />);

            const textarea = screen.getByLabelText('生成テキスト');
            await user.click(textarea);
            await user.keyboard('{Control>}a{/Control}編集済みテキスト');

            await user.click(screen.getByRole('button', { name: 'フォームの内容から再生成' }));

            expect(textarea).toHaveValue(SAMPLE_TEXT);
            expect(screen.queryByText(/手動編集中/)).not.toBeInTheDocument();
        });

        it('未編集のときは再生成ボタンを表示しない', () => {
            render(<SheetPreview generatedText={SAMPLE_TEXT} />);

            expect(screen.queryByRole('button', { name: 'フォームの内容から再生成' })).not.toBeInTheDocument();
        });

        it('コピーは編集後のテキストを送る', async () => {
            const user = userEvent.setup();
            const writeText = vi.spyOn(navigator.clipboard, 'writeText');
            render(<SheetPreview generatedText={SAMPLE_TEXT} />);

            const textarea = screen.getByLabelText('生成テキスト');
            await user.click(textarea);
            await user.keyboard('{Control>}a{/Control}編集済みテキスト');

            await user.click(screen.getByRole('button', { name: 'コピーする' }));

            expect(writeText).toHaveBeenCalledWith('編集済みテキスト');
        });
    });
});
