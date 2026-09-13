'use server';

import { getVerifiedAalLevels, isMfaChallengePending } from '@repo/supabase/aal';
import { redirect } from 'next/navigation';

import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure } from '@/shared/types/action-result';

import { findActiveAdmin } from './guard';

/**
 * 管理者ログイン（contracts/admin-auth.md）。
 * 認証成功後に管理者であることを確認し、管理者でなければ即サインアウトして
 * 利用者セッションを admin-front に残さない。
 *
 * 2 要素認証を有効化している管理者は、パスワード成功後に /login/verify で
 * 2 段階目（SMS コード）を完了するまで管理画面に入れない。
 */
export const signInAdmin = async (email: string, password: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
        return actionFailure('メールアドレスまたはパスワードが間違っています');
    }

    const admin = await findActiveAdmin(supabase, data.user.id);
    if (!admin) {
        /**
         * scope: 'local' で admin-front の Cookie だけを破棄する。
         * 既定の 'global' は同一 auth.users の全リフレッシュトークンを失効させるため、
         * 一般ユーザーが誤って管理画面にログインを試みるだけで service-front からも
         * 全端末ログアウトされてしまう。
         */
        await supabase.auth.signOut({ scope: 'local' });
        return actionFailure('管理者権限がありません');
    }

    if (isMfaChallengePending(await getVerifiedAalLevels(supabase, { user: data.user }))) {
        redirect('/login/verify');
    }

    redirect('/');
};

/** 管理者ログアウト。以降は全 (admin) URL にアクセス不可になる（FR-004） */
export const signOutAdmin = async (): Promise<void> => {
    const supabase = await createClient();
    /** admin-front のセッションのみ破棄する（service-front の利用者セッションを巻き込まない） */
    await supabase.auth.signOut({ scope: 'local' });
    redirect('/login');
};
