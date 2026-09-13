import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import type { ContactFormValues } from '@/features/contact/schemas/contact.schema';

const submitInquiry = vi.fn();
vi.mock('@/features/contact/server/actions', () => ({
    submitInquiry: (...args: unknown[]) => submitInquiry(...args),
}));

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { ContactForm } from './ContactForm';

const emptyValues: ContactFormValues = { name: '', email: '', category: '', body: '', website: '' };

const filledValues: ContactFormValues = {
    name: '山田太郎',
    email: 'taro@example.com',
    category: 'question',
    body: '質問があります',
    website: '',
};

/** 入力 → 確認画面へ進む */
const proceedToConfirm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: '確認画面へ進む' }));
};

describe('ContactForm', () => {
    beforeEach(() => {
        submitInquiry.mockReset();
        push.mockReset();
    });

    it('defaultValues がフォーム初期値として反映される', () => {
        render(<ContactForm defaultValues={filledValues} />);

        expect(screen.getByLabelText<HTMLInputElement>(/お名前/).value).toBe('山田太郎');
        expect(screen.getByLabelText<HTMLInputElement>(/メールアドレス/).value).toBe('taro@example.com');
    });

    it('必須項目が空のまま確認へ進もうとするとバリデーションエラーを表示し、確認画面に進まない', async () => {
        const user = userEvent.setup();
        render(<ContactForm defaultValues={emptyValues} />);

        await proceedToConfirm(user);

        expect(await screen.findByText('お名前を入力してください')).toBeInTheDocument();
        expect(screen.getByText('メールアドレスを入力してください')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '送信する' })).not.toBeInTheDocument();
        expect(submitInquiry).not.toHaveBeenCalled();
    });

    it('確認画面に入力内容（種別はラベル表示）を表示する', async () => {
        const user = userEvent.setup();
        render(<ContactForm defaultValues={filledValues} />);

        await proceedToConfirm(user);

        expect(await screen.findByText('入力内容をご確認のうえ、送信してください。')).toBeInTheDocument();
        expect(screen.getByText('山田太郎')).toBeInTheDocument();
        expect(screen.getByText('taro@example.com')).toBeInTheDocument();
        // category 'question' はラベル「ご質問」で表示
        expect(screen.getByText('ご質問')).toBeInTheDocument();
        expect(screen.getByText('質問があります')).toBeInTheDocument();
    });

    it('確認画面から修正すると入力画面に戻り、入力値が保持される', async () => {
        const user = userEvent.setup();
        render(<ContactForm defaultValues={filledValues} />);

        await proceedToConfirm(user);
        await user.click(await screen.findByRole('button', { name: '入力内容を修正する' }));

        expect(screen.getByLabelText<HTMLInputElement>(/お名前/).value).toBe('山田太郎');
    });

    it('確認画面で送信すると submitInquiry を呼び、成功でサンクスページへ遷移する', async () => {
        submitInquiry.mockResolvedValue({ success: true });
        const user = userEvent.setup();
        render(<ContactForm defaultValues={filledValues} />);

        await proceedToConfirm(user);
        await user.click(await screen.findByRole('button', { name: '送信する' }));

        await waitFor(() => expect(submitInquiry).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(push).toHaveBeenCalledWith('/contact/complete'));
    });

    it('送信に失敗すると確認画面にエラー（role=alert）を表示し、遷移しない', async () => {
        submitInquiry.mockResolvedValue({
            success: false,
            error: '送信に失敗しました。時間をおいて再度お試しください',
        });
        const user = userEvent.setup();
        render(<ContactForm defaultValues={filledValues} />);

        await proceedToConfirm(user);
        await user.click(await screen.findByRole('button', { name: '送信する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('送信に失敗しました');
        expect(push).not.toHaveBeenCalled();
    });
});
