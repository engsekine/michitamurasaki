'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

/** SMS ワンタイムコードの桁数（supabase/config.toml [auth.mfa.phone] otp_length と一致させる） */
const OTP_LENGTH = 6;
const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

/** ログイン 2 段階目の challenge 結果 */
export interface AdminChallengePayload {
    challengeId: string;
}

/**
 * 現在のセッションの verified な phone 要素 ID を返す（2 段階目ページの初期表示用）。
 * listFactors は Auth サーバーへ問い合わせるため、cookie 内の factors には依存しない。
 */
export const getLoginMfaFactorId = async (): Promise<string | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return null;

    const verified = (data.phone ?? []).find((factor) => factor.status === 'verified');
    return verified?.id ?? null;
};

/**
 * ログイン 2 段階目の確認コードを送信する（再送にも使う）。
 * factorId の所有権は Supabase Auth が本人のものかを検証する。
 */
export const challengeAdminLoginFactor = async (factorId: string): Promise<ActionResult<AdminChallengePayload>> => {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error || !data) {
        if (error?.status === 429) {
            return actionFailure('確認コードの再送は、しばらく時間をおいてからお試しください');
        }
        return actionFailure('確認コードの送信に失敗しました。時間をおいて再度お試しください');
    }

    return actionSuccess<AdminChallengePayload>({ challengeId: data.id });
};

/**
 * ログイン 2 段階目のコードを検証し、成功したら AAL2 に昇格してダッシュボードへ進む。
 * 誤り・期限切れコードは拒否して再入力させる。
 */
export const verifyAdminLogin = async (factorId: string, challengeId: string, code: string): Promise<ActionResult> => {
    if (!OTP_PATTERN.test(code)) {
        return actionFailure(`${OTP_LENGTH} 桁の数字を入力してください`);
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    if (error) {
        return actionFailure('確認コードが正しくありません。もう一度お試しください');
    }

    redirect('/');
};
