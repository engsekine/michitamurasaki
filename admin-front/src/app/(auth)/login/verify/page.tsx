import { redirect } from 'next/navigation';

import { MfaChallengeForm, resolveAdminSession } from '@/features/admin-auth';
import { getLoginMfaFactorId } from '@/features/admin-auth/server/mfaActions';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata({
    slug: '/login/verify',
    title: '2 段階認証',
    description: '管理者ログインの 2 段階目を確認します',
});

/**
 * 管理者ログイン 2 段階目（SMS 2 要素認証）の確認ページ。
 * proxy の AUTH_ROUTES（完全一致）に含まれないため、認証済み（AAL1）でも到達できる。
 * 未認証はログインへ、2 段階目が不要（未有効化 or 既に AAL2）ならダッシュボードへ振り分ける。
 */
export default async function AdminMfaVerifyPage() {
    const state = await resolveAdminSession();
    if (state.kind === 'unauthenticated') redirect('/login');
    /** 2 段階目が不要なら通常の導線へ（非管理者は requireAdmin 側で署名アウトされる） */
    if (state.kind !== 'mfa_pending') redirect('/');

    const factorId = await getLoginMfaFactorId();
    if (!factorId) redirect('/api/auth/signout');

    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
            <h1 className="font-semibold text-2xl">2 段階認証</h1>
            <MfaChallengeForm factorId={factorId} />
        </div>
    );
}
