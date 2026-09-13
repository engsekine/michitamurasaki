import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Mock } from 'jest-mock';

import { supabase } from '../../../lib/supabase/client';
import { LoginForm } from './LoginForm';

jest.mock('../../../lib/supabase/client', () => ({
    supabase: { auth: { signInWithPassword: jest.fn() } },
}));

type SignInMock = Mock<(input: { email: string; password: string }) => Promise<{ error: { message: string } | null }>>;
const mockedSignIn = supabase.auth.signInWithPassword as unknown as SignInMock;

describe('LoginForm', () => {
    beforeEach(() => {
        mockedSignIn.mockReset();
    });

    it('未入力で送信するとバリデーションエラーを表示し、認証を呼ばない', async () => {
        const view = await render(<LoginForm />);

        await fireEvent.press(view.getByRole('button', { name: 'ログイン' }));

        expect(await view.findByText('メールアドレスとパスワードを入力してください')).toBeTruthy();
        expect(mockedSignIn).not.toHaveBeenCalled();
    });

    it('入力して送信すると signInWithPassword を呼ぶ（FR-018）', async () => {
        mockedSignIn.mockResolvedValue({ error: null });
        const view = await render(<LoginForm />);

        await fireEvent.changeText(view.getByLabelText('メールアドレス'), ' taro@example.com ');
        await fireEvent.changeText(view.getByLabelText('パスワード'), 'password123');
        await fireEvent.press(view.getByRole('button', { name: 'ログイン' }));

        await waitFor(() =>
            expect(mockedSignIn).toHaveBeenCalledWith({ email: 'taro@example.com', password: 'password123' }),
        );
    });

    it('認証失敗時はエラーメッセージを表示する', async () => {
        mockedSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
        const view = await render(<LoginForm />);

        await fireEvent.changeText(view.getByLabelText('メールアドレス'), 'taro@example.com');
        await fireEvent.changeText(view.getByLabelText('パスワード'), 'wrong');
        await fireEvent.press(view.getByRole('button', { name: 'ログイン' }));

        expect(await view.findByText('メールアドレスまたはパスワードが間違っています')).toBeTruthy();
    });
});
