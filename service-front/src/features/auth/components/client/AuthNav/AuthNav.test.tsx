import type { User as SupabaseUser } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const signOut = vi.fn();
const mockStoreState: {
    user: SupabaseUser | null;
    setUser: ReturnType<typeof vi.fn>;
    clearUser: ReturnType<typeof vi.fn>;
} = {
    user: null,
    setUser: vi.fn(),
    clearUser: vi.fn(),
};

vi.mock('@/features/auth/server/actions', () => ({
    signOut: (...args: unknown[]) => signOut(...args),
}));

vi.mock('@/shared/lib/supabase/browser', () => ({
    createClient: () => ({
        auth: {
            onAuthStateChange: () => ({
                data: { subscription: { unsubscribe: vi.fn() } },
            }),
        },
    }),
}));

vi.mock('@/shared/stores/user-store', () => ({
    useUserStore: <T,>(selector: (state: typeof mockStoreState) => T): T => selector(mockStoreState),
}));

import { AuthNav } from './AuthNav';

const buildUser = (overrides: Partial<SupabaseUser> = {}): SupabaseUser =>
    ({
        id: 'user-1',
        email: 'user@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-01-01T00:00:00Z',
        ...overrides,
    }) as SupabaseUser;

describe('AuthNav', () => {
    beforeEach(() => {
        signOut.mockReset();
        mockStoreState.user = null;
        mockStoreState.setUser.mockClear();
        mockStoreState.clearUser.mockClear();
    });

    it('未ログイン状態ではログインメニューを開くアイコンボタンを表示する', () => {
        render(<AuthNav initialUser={null} />);

        expect(screen.getByRole('button', { name: 'ログインメニューを開く' })).toBeInTheDocument();
    });

    it('ログイン済み状態ではアカウントメニューを開くアイコンボタンを表示する', () => {
        const user = buildUser();
        mockStoreState.user = user;

        render(<AuthNav initialUser={user} />);

        expect(screen.getByRole('button', { name: 'アカウントメニューを開く' })).toBeInTheDocument();
    });

    it('未ログイン状態でアイコンボタンを押すとシート内にログイン・会員登録リンクを表示する', async () => {
        const userEventInstance = userEvent.setup();
        render(<AuthNav initialUser={null} />);

        await userEventInstance.click(screen.getByRole('button', { name: 'ログインメニューを開く' }));

        const loginLink = await screen.findByRole('link', { name: /ログイン/ });
        expect(loginLink).toHaveAttribute('href', '/login');

        const signupLink = screen.getByRole('link', { name: /会員登録/ });
        expect(signupLink).toHaveAttribute('href', '/signup');
    });

    it('user_metadata に handle があるとマイプロフィールはユーザー ID の URL になる（034 / FR-004）', async () => {
        const user = buildUser({ email: 'user@example.com', user_metadata: { handle: 'taro' } });
        mockStoreState.user = user;

        const userEventInstance = userEvent.setup();
        render(<AuthNav initialUser={user} />);

        await userEventInstance.click(screen.getByRole('button', { name: 'アカウントメニューを開く' }));

        const myProfileLink = await screen.findByRole('link', { name: /マイプロフィール/ });
        expect(myProfileLink).toHaveAttribute('href', '/users/taro');
    });

    it('ログイン済み状態でアイコンボタンを押すとシート内に会員情報・保有資格リンクとログアウトボタンを表示する', async () => {
        const user = buildUser({ email: 'user@example.com' });
        mockStoreState.user = user;

        const userEventInstance = userEvent.setup();
        render(<AuthNav initialUser={user} />);

        await userEventInstance.click(screen.getByRole('button', { name: 'アカウントメニューを開く' }));

        const myProfileLink = await screen.findByRole('link', { name: /マイプロフィール/ });
        expect(myProfileLink).toHaveAttribute('href', '/users/user-1');

        const userSearchLink = screen.getByRole('link', { name: /ユーザーを探す/ });
        expect(userSearchLink).toHaveAttribute('href', '/users/search');

        const profileLink = screen.getByRole('link', { name: /会員情報/ });
        expect(profileLink).toHaveAttribute('href', '/settings/profile');

        const certificationsLink = screen.getByRole('link', { name: /保有資格/ });
        expect(certificationsLink).toHaveAttribute('href', '/settings/certifications');

        const logCreditsLink = screen.getByRole('link', { name: /ログ枠の購入/ });
        expect(logCreditsLink).toHaveAttribute('href', '/settings/log-credits');

        expect(screen.getByRole('button', { name: /ログアウト/ })).toBeInTheDocument();
        expect(screen.getByText('user@example.com')).toBeInTheDocument();
    });

    it('ログアウトボタンを押すと signOut が呼ばれる', async () => {
        signOut.mockResolvedValue(undefined);
        const user = buildUser();
        mockStoreState.user = user;

        const userEventInstance = userEvent.setup();
        render(<AuthNav initialUser={user} />);

        await userEventInstance.click(screen.getByRole('button', { name: 'アカウントメニューを開く' }));
        await userEventInstance.click(await screen.findByRole('button', { name: /ログアウト/ }));

        expect(signOut).toHaveBeenCalled();
    });
});
