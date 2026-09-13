import type { AalAuthClient } from '@repo/supabase/aal';
import { getVerifiedAalLevels, isMfaChallengePending } from '@repo/supabase/aal';
import type { User } from '@supabase/supabase-js';

import { actionFailure } from '@/shared/types/action-result';

/** requireUser が必要とする最小の Supabase クライアント形（テスト・型結合を最小化） */
type AuthClient = AalAuthClient;

type RequireUserResult = { user: User; failure: null } | { user: null; failure: { success: false; error: string } };

export const MFA_REQUIRED_MESSAGE = '2 段階認証を完了してください';

/**
 * Server Action の認証ガード。未ログインなら ActionResult 互換の失敗を返す。
 *
 * 2 要素認証を有効化しているユーザーが 1 段階目しか通過していない（AAL1→AAL2 保留）場合も
 * 失敗を返す。Server Action は任意のクライアントから直接呼べるため、画面側の
 * (authenticated)/layout の遮断だけでは 2 段階目を回避してデータ操作ができてしまう。
 * 未有効化ユーザーはクレーム取得に行かないため、判定コストは増えない。
 *
 * 使い方（failure が判別子になり、ガード後は user が非 null に絞られる）:
 * ```ts
 * const { user, failure } = await requireUser(supabase);
 * if (failure) return failure;
 * ```
 */
export const requireUser = async (supabase: AuthClient): Promise<RequireUserResult> => {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { user: null, failure: actionFailure('ログインが必要です') };

    if (isMfaChallengePending(await getVerifiedAalLevels(supabase, { user }))) {
        return { user: null, failure: actionFailure(MFA_REQUIRED_MESSAGE) };
    }

    return { user, failure: null };
};
