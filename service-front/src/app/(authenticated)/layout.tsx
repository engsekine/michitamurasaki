import { redirect } from 'next/navigation';

import { DailyBonusModal } from '@/features/credits/components/client/DailyBonusModal';
import { getCreditBalance } from '@/features/credits/server/queries';
import { getVerifiedAalLevels, isMfaChallengePending } from '@/features/mfa/lib/aalGuard';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * 認証必須ルートのプロフィール補完ゲート（016-google-login）。
 *
 * Google ログイン初回ユーザーは user_details が未作成（補完未完了）の状態で
 * セッションを持つ。その状態で /dives などの本体ルートに来たら、
 * /profile-completion へ誘導して補完を促す（FR-005 / FR-015）。
 *
 * /profile-completion 自体は (onboarding) グループに置き本レイアウトの配下に
 * 含めないため、リダイレクトループは発生しない。
 * 補完判定は user_details 行の有無を 1 回 SELECT するのみ（research.md Decision 4）。
 */
export default async function AuthenticatedLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    /** 未認証は proxy で /login に弾かれるが、防御的に確認する */
    if (!user) redirect('/login');

    /**
     * メール未確認のログインを拒否する（FR-006）。
     * Google が返すメールは通常 email_verified=true で取り込まれるためレアケースだが、
     * 万一未確認のままセッションが張られた場合に防御的に弾く。
     */
    if (!user.email_confirmed_at) {
        await supabase.auth.signOut();
        redirect('/login?error=email_not_verified');
    }

    /**
     * SMS 2 要素認証（023 / US2 / FR-010）。2 要素認証を有効化しているユーザーが
     * 1 段階目（パスワード / Google）だけ通過した状態（AAL1→AAL2 保留）では、
     * 保護ルートに入れず 2 段階目チャレンジへ誘導する。
     * /login/verify は本レイアウト配下ではないためループしない。
     * 未有効化ユーザーは AAL1→AAL1 のため素通りする（体験不変 / FR-015）。
     *
     * 判定は検証済みの user（getUser）と署名検証済みクレーム（getClaims）から行う。
     * cookie 内の user.factors を根拠にする getAuthenticatorAssuranceLevel() は
     * cookie 改ざんで 2 段階目を回避できたため使わない。
     * 未有効化ユーザーはクレーム取得に行かないため、AAL 判定の障害で全員がロックアウトされることはない。
     */
    if (isMfaChallengePending(await getVerifiedAalLevels(supabase, { user }))) {
        redirect('/login/verify');
    }

    const { data: details } = await supabase
        .from('user_details')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (!details) redirect('/profile-completion');

    /**
     * デイリーボーナス（026 / FR-003）。その日（JST）はじめての訪問で
     * ログ枠を 1 つ自動付与する。RPC は冪等（付与済みなら no-op）なので
     * 並行リクエスト・リロードで二重付与されない。
     * 失敗してもレイアウトは落とさない（ボーナスは次回訪問で回復する）。
     *
     * 返り値 granted は「この訪問で付与が発生したか」（036 FR-001）。
     * 付与が発生した訪問でのみ獲得モーダルを表示する。リロード・同日再訪問は
     * false が返るため再表示されず、layout はクライアント遷移で再実行されない
     * ためページ移動でも再表示されない（036 FR-003）。
     */
    const { data: granted, error: bonusError } = await supabase.rpc('grant_daily_bonus');
    if (bonusError) console.error('[AuthenticatedLayout] デイリーボーナスの付与に失敗しました:', bonusError);

    // 残枠は付与が発生したときだけ取得する（通常アクセスにコストを足さない）。
    // 取得失敗時は null でモーダル表示自体は続行する（枠数表示のみ省略 / 036 SC-004）
    const remainingCredits = granted === true ? await getCreditBalance().catch(() => null) : null;

    return (
        <>
            {granted === true && <DailyBonusModal remainingCredits={remainingCredits} />}
            {children}
        </>
    );
}
