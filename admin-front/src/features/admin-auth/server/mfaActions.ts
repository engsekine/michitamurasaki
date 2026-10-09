'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure } from '@/shared/types/action-result';

/** 認証アプリ（TOTP）ワンタイムコードの桁数。RFC 6238 の既定どおり 6 桁固定 */
const OTP_LENGTH = 6;
const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);
const RATE_LIMIT_STATUS = 429;

/**
 * 現在のセッションの verified な TOTP 要素 ID を返す（2 段階目ページの初期表示用）。
 * listFactors は Auth サーバーへ問い合わせるため、cookie 内の factors には依存しない。
 */
export const getLoginMfaFactorId = async (): Promise<string | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return null;

    const verified = (data.totp ?? []).find((factor) => factor.status === 'verified');
    return verified?.id ?? null;
};

/**
 * ログイン 2 段階目の認証アプリのコードを検証し、成功したら AAL2 に昇格してダッシュボードへ進む。
 * TOTP は送信工程が無いので challenge と verify を一括で行う。誤り・期限切れコードは拒否して再入力させる。
 * factorId の所有権は Supabase Auth が本人のものかを検証する。
 */
export const verifyAdminLogin = async (factorId: string, code: string): Promise<ActionResult> => {
    if (!OTP_PATTERN.test(code)) {
        return actionFailure(`${OTP_LENGTH} 桁の数字を入力してください`);
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) {
        if (error.status === RATE_LIMIT_STATUS) {
            return actionFailure('試行回数が多すぎます。しばらく時間をおいてからお試しください');
        }
        return actionFailure('確認コードが正しくありません。もう一度お試しください');
    }

    redirect('/');
};
