import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ProfileFormValues } from '@/features/account/schemas/profile.schema';

const updateProfile = vi.fn();

vi.mock('@/features/account/server/actions', () => ({
    updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

import { ProfileEditForm } from './ProfileEditForm';

const defaultValues: ProfileFormValues = {
    lastName: '山田',
    firstName: '太郎',
    lastNameRomaji: 'Yamada',
    firstNameRomaji: 'Taro',
    nickname: 'たろちゃん',
    handle: 'taro-diver',
    birthOn: '1990-01-01',
    gender: 'male',
    heightCm: null,
    weightKg: null,
    diverType: null,
    diverNumber: null,
    emailOptIn: false,
};

describe('ProfileEditForm', () => {
    beforeEach(() => {
        updateProfile.mockReset();
    });

    it('メールアドレスを readonly として表示する', () => {
        render(<ProfileEditForm email="user@example.com" defaultValues={defaultValues} />);

        const emailInput = screen.getByLabelText<HTMLInputElement>('メールアドレス');
        expect(emailInput.value).toBe('user@example.com');
        expect(emailInput).toHaveAttribute('readonly');
    });

    it('defaultValues がフォーム初期値として反映される', () => {
        render(<ProfileEditForm email="user@example.com" defaultValues={defaultValues} />);

        expect(screen.getByLabelText<HTMLInputElement>('姓').value).toBe('山田');
        expect(screen.getByLabelText<HTMLInputElement>('名').value).toBe('太郎');
        expect(screen.getByLabelText<HTMLInputElement>('ニックネーム').value).toBe('たろちゃん');
    });

    it('ダイバー種別の初期値がインストラクターのとき番号欄に初期値が反映される（019）', () => {
        render(
            <ProfileEditForm
                email="user@example.com"
                defaultValues={{ ...defaultValues, diverType: 'instructor', diverNumber: 'PADI-12345' }}
            />,
        );

        expect(screen.getByLabelText<HTMLInputElement>('ダイバー番号').value).toBe('PADI-12345');
    });

    it('種別が未設定のときは番号欄を表示しない（019）', () => {
        render(<ProfileEditForm email="user@example.com" defaultValues={defaultValues} />);

        expect(screen.queryByLabelText('ダイバー番号')).not.toBeInTheDocument();
    });

    it('更新時に diverType / diverNumber が updateProfile に渡る（019）', async () => {
        updateProfile.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(
            <ProfileEditForm
                email="user@example.com"
                defaultValues={{ ...defaultValues, diverType: 'instructor', diverNumber: 'PADI-12345' }}
            />,
        );

        await user.clear(screen.getByLabelText('ニックネーム'));
        await user.type(screen.getByLabelText('ニックネーム'), 'newnick');
        await user.click(screen.getByRole('button', { name: '更新する' }));

        await screen.findByRole('status');
        expect(updateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ diverType: 'instructor', diverNumber: 'PADI-12345' }),
        );
    });

    it('初期状態（未編集）では更新ボタンが無効化される', () => {
        render(<ProfileEditForm email="user@example.com" defaultValues={defaultValues} />);

        expect(screen.getByRole('button', { name: '更新する' })).toBeDisabled();
    });

    it('身長・体重フィールドを表示し、初期値がある場合は反映される', () => {
        render(
            <ProfileEditForm
                email="user@example.com"
                defaultValues={{ ...defaultValues, heightCm: 170.5, weightKg: 65 }}
            />,
        );

        expect(screen.getByLabelText<HTMLInputElement>('身長（cm）').value).toBe('170.5');
        expect(screen.getByLabelText<HTMLInputElement>('体重（kg）').value).toBe('65');
    });

    it('メール配信許可（022）の初期値が反映され、切り替えると更新できる', async () => {
        updateProfile.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<ProfileEditForm email="user@example.com" defaultValues={{ ...defaultValues, emailOptIn: true }} />);

        const optIn = screen.getByRole('checkbox', { name: /お知らせメールを受け取る/ });
        expect(optIn).toBeChecked();

        await user.click(optIn); // ON → OFF（撤回）
        await user.click(screen.getByRole('button', { name: '更新する' }));

        await screen.findByRole('status');
        expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ emailOptIn: false }));
    });

    it('不正な形式・予約語のユーザー ID はエラーを表示して送信しない（034 / FR-002・003）', async () => {
        const user = userEvent.setup();
        render(<ProfileEditForm email="user@example.com" defaultValues={defaultValues} />);

        await user.clear(screen.getByLabelText('ユーザー ID'));
        await user.type(screen.getByLabelText('ユーザー ID'), 'a/b');
        await user.click(screen.getByRole('button', { name: '更新する' }));
        expect(
            await screen.findByText(
                'ユーザー ID は半角英小文字・数字・ - _ の 3〜30 文字（先頭は英字）で入力してください',
            ),
        ).toBeInTheDocument();

        await user.clear(screen.getByLabelText('ユーザー ID'));
        await user.type(screen.getByLabelText('ユーザー ID'), 'search');
        await user.click(screen.getByRole('button', { name: '更新する' }));
        expect(await screen.findByText('このユーザー ID は使用できません')).toBeInTheDocument();

        expect(updateProfile).not.toHaveBeenCalled();
    });

    it('updateProfile が成功すると status メッセージを表示する', async () => {
        updateProfile.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<ProfileEditForm email="user@example.com" defaultValues={defaultValues} />);

        await user.clear(screen.getByLabelText('ニックネーム'));
        await user.type(screen.getByLabelText('ニックネーム'), 'newnick');
        await user.click(screen.getByRole('button', { name: '更新する' }));

        expect(await screen.findByRole('status')).toHaveTextContent('プロフィールを更新しました');
        expect(updateProfile).toHaveBeenCalled();
    });

    it('updateProfile がエラーを返すと alert に表示される', async () => {
        updateProfile.mockResolvedValueOnce({ success: false, error: '更新に失敗しました' });
        const user = userEvent.setup();
        render(<ProfileEditForm email="user@example.com" defaultValues={defaultValues} />);

        await user.clear(screen.getByLabelText('ニックネーム'));
        await user.type(screen.getByLabelText('ニックネーム'), 'newnick');
        await user.click(screen.getByRole('button', { name: '更新する' }));

        expect(await screen.findByText('更新に失敗しました')).toBeInTheDocument();
    });
});
