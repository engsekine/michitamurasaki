import { getVerifiedAalLevels, isMfaChallengePending } from '@repo/supabase/aal';
import { redirect } from 'next/navigation';

import { createClient } from '@/shared/lib/supabase/server';

import type { AdminUser } from '../types';

type AdminClient = Awaited<ReturnType<typeof createClient>>;

/** セッションの解決結果。requireAdmin が遷移先を分けるために種別を持つ */
export type AdminSessionState =
    | { kind: 'unauthenticated' }
    /** 1 段階目は通過したが 2 要素認証の 2 段階目が未完了（AAL1→AAL2 保留） */
    | { kind: 'mfa_pending' }
    | { kind: 'not_admin' }
    | { kind: 'admin'; admin: AdminUser };

/**
 * admin_users から有効な管理者行を取得する（AAL は見ない）。
 * RLS（admins read admin users）により、管理者本人の行のみ取得できる。
 * deleted_at is null で無効化済みを除外する。
 */
export const findActiveAdmin = async (supabase: AdminClient, userId: string): Promise<AdminUser | null> => {
    const { data, error } = await supabase
        .from('admin_users')
        .select('id, display_name, role')
        .eq('id', userId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error || !data) return null;

    return {
        id: data.id,
        displayName: data.display_name,
        role: data.role === 'superadmin' ? 'superadmin' : 'admin',
    };
};

/**
 * 現在のセッション状態を解決する（副作用なし）。
 *
 * なぜ AAL を見るか: 管理者は service-front と auth.users を共有しており、service-front で
 * 2 要素認証を有効化していても admin-front はパスワードのみで全権限を与えていた。
 * 最も強い権限面に最も弱い認証しか掛からない状態を防ぐため、2 段階目が保留中の
 * セッションは管理者として扱わない。判定は検証済みの user とクレームから行う
 * （cookie 内の user.factors は改ざん可能なため使わない）。
 */
export const resolveAdminSession = async (): Promise<AdminSessionState> => {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { kind: 'unauthenticated' };

    if (isMfaChallengePending(await getVerifiedAalLevels(supabase, { user }))) return { kind: 'mfa_pending' };

    const admin = await findActiveAdmin(supabase, user.id);
    if (!admin) return { kind: 'not_admin' };

    return { kind: 'admin', admin };
};

/**
 * 現在のセッションが有効な管理者かを判定して返す（副作用なし）。
 * 未認証・非管理者・無効化済み・2 段階目未完了の場合は null を返す。
 * proxy（一次ガード）や、リダイレクトせず分岐したい箇所で使う。
 */
export const getAdminUser = async (): Promise<AdminUser | null> => {
    const state = await resolveAdminSession();
    return state.kind === 'admin' ? state.admin : null;
};

/**
 * 管理者であることを要求する二次ガード（多層防御 / SC-001）。
 * 全 queries.ts / actions.ts の冒頭で呼ぶ。
 *
 * - 2 段階目が保留中なら /login/verify へ誘導する（セッションは維持し、コード入力で昇格させる）
 * - それ以外の失敗時は署名アウト用 Route Handler 経由でログインへ誘導する。
 *   直接 /login に飛ばすと「認証済みだが非管理者」（無効化直後の管理者等）のセッションが残り、
 *   proxy（認証済みは /login → /）との間で無限リダイレクトになるため。
 *   Server Component のレンダリング中は Cookie を変更できないので、
 *   signOut は Route Handler（/api/auth/signout）側で行う。
 */
export const requireAdmin = async (): Promise<AdminUser> => {
    const state = await resolveAdminSession();
    if (state.kind === 'mfa_pending') redirect('/login/verify');
    if (state.kind !== 'admin') redirect('/api/auth/signout');
    return state.admin;
};
