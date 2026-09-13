import { redirect } from 'next/navigation';

import { getMfaStatus, MfaChallengeForm } from '@/features/mfa';
import { getVerifiedAalLevels, isMfaChallengePending } from '@/features/mfa/lib/aalGuard';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';
import { createClient } from '@/shared/lib/supabase/server';

export const metadata = generatePageMetadata(
    {
        slug: '/login/verify',
        title: '2 段階認証',
        description: 'ログインの 2 段階目を確認します',
    },
    { noIndex: true },
);

/**
 * ログイン 2 段階目（SMS 2 要素認証）の確認ページ（023 / US2 / FR-010）。
 * proxy の AUTH_ROUTES（完全一致）に含まれないため、認証済み（AAL1）でも到達できる。
 * 未認証・2 段階目不要（AAL2 済み or 未有効化）の場合は適切に振り分ける。
 */
export default async function MfaVerifyPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    /**
     * 判定は検証済みの user と署名検証済みクレームから行う（cookie 改ざん耐性）。
     * 2 段階目が不要（未有効化 or 既に AAL2）なら通常のトップへ
     */
    const pending = isMfaChallengePending(await getVerifiedAalLevels(supabase, { user }));
    if (!pending) redirect('/');

    const status = await getMfaStatus();
    if (!status.factorId) redirect('/');

    return (
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
            <Heading level={1}>2 段階認証</Heading>
            <MfaChallengeForm factorId={status.factorId} />
        </div>
    );
}
