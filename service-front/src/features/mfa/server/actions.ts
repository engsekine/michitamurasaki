'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

/** enroll + 初回 challenge の結果。verify に必要な id を返す */
export interface EnrollPayload {
    factorId: string;
    challengeId: string;
}

/** ログイン 2 段階目の challenge 結果 */
export interface ChallengePayload {
    challengeId: string;
}

/** 現在ユーザーの 2 要素認証の状態（設定画面・ログイン 2 段階目で使用） */
export interface MfaStatus {
    /** verified な phone 要素があるか（＝2 要素認証が有効） */
    enabled: boolean;
    /** 対象の phone 要素 ID（challenge/verify/disable に使う）。無ければ null */
    factorId: string | null;
}

/**
 * 電話番号を登録し（enroll）、確認コードを送信する（challenge）（FR-008/009）。
 * verify 前は要素は unverified で、コード確認に成功して初めて有効化される。
 */
export const enrollPhoneFactor = async (phone: string): Promise<ActionResult<EnrollPayload>> => {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'phone', phone });
    if (error || !data) {
        return actionFailure('電話番号の登録を開始できませんでした。番号（国際形式）をご確認ください');
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: data.id });
    if (challengeError || !challenge) {
        return actionFailure('確認コードの送信に失敗しました。時間をおいて再度お試しください');
    }

    return actionSuccess<EnrollPayload>({ factorId: data.id, challengeId: challenge.id });
};

/**
 * 登録した電話番号の確認コードを検証し、2 要素認証を有効化する（FR-009）。
 * 誤り・期限切れコードは拒否する（FR-011 相当）。
 */
export const verifyPhoneFactor = async (factorId: string, challengeId: string, code: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    if (error) {
        return actionFailure('確認コードが正しくありません。もう一度お試しください');
    }

    return actionSuccess();
};

/** 2 要素認証を無効化する（FR-014）。以後のログインで 2 段階目を求めない */
export const disablePhoneFactor = async (factorId: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
        return actionFailure('2 要素認証の無効化に失敗しました。時間をおいて再度お試しください');
    }

    return actionSuccess();
};

/** 現在ユーザーの 2 要素認証状態を取得する（設定画面・2 段階目ページの初期表示） */
export const getMfaStatus = async (): Promise<MfaStatus> => {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
        return { enabled: false, factorId: null };
    }

    const phoneFactors = data.phone ?? [];
    const verified = phoneFactors.find((factor) => factor.status === 'verified');
    if (verified) {
        return { enabled: true, factorId: verified.id };
    }

    const pending = phoneFactors[0];
    return { enabled: false, factorId: pending?.id ?? null };
};

/**
 * ログイン 2 段階目の確認コードを送信する（FR-010）。再送にも使う（FR-012/013）。
 * レート制限時はその旨を返す。
 */
export const challengeLoginFactor = async (factorId: string): Promise<ActionResult<ChallengePayload>> => {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error || !data) {
        if (error?.status === 429) {
            return actionFailure('確認コードの再送は、しばらく時間をおいてからお試しください');
        }
        return actionFailure('確認コードの送信に失敗しました。時間をおいて再度お試しください');
    }

    return actionSuccess<ChallengePayload>({ challengeId: data.id });
};

/**
 * ログイン 2 段階目のコードを検証し、成功したら AAL2 に昇格して TOP（`/`）へ進む（FR-010/011）。
 * 誤り・期限切れコードは拒否して再入力させる。
 */
export const verifyLogin = async (factorId: string, challengeId: string, code: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    if (error) {
        return actionFailure('確認コードが正しくありません。もう一度お試しください');
    }

    redirect('/');
};
