'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

/**
 * 認証アプリに表示される発行者名・要素名。
 * Supabase は同名の verified 要素が既にあると enroll を拒否するため、
 * enroll 前に未検証の残骸を解除してから登録する（enrollTotpFactor 参照）。
 */
const TOTP_ISSUER = 'ダイビングログ';
const TOTP_FRIENDLY_NAME = '認証アプリ';

/** enroll の結果。QR コードを読めない場合に備えてシークレットも返す */
export interface EnrollPayload {
    factorId: string;
    /** `data:image/svg+xml;utf-8,...` 形式の QR コード画像（img の src にそのまま使える） */
    qrCode: string;
    /** 認証アプリへ手入力するためのシークレット */
    secret: string;
}

/** 現在ユーザーの 2 要素認証の状態（設定画面・ログイン 2 段階目で使用） */
export interface MfaStatus {
    /** verified な TOTP 要素があるか（＝2 要素認証が有効） */
    enabled: boolean;
    /** 対象の TOTP 要素 ID（verify/disable に使う）。無ければ null */
    factorId: string | null;
}

const RATE_LIMIT_STATUS = 429;

const toVerifyFailure = (error: { status?: number | undefined } | null): ActionResult => {
    if (error?.status === RATE_LIMIT_STATUS) {
        return actionFailure('試行回数が多すぎます。しばらく時間をおいてからお試しください');
    }
    return actionFailure('確認コードが正しくありません。もう一度お試しください');
};

/**
 * 認証アプリ（TOTP）の要素を登録し、QR コードとシークレットを返す（FR-008/009）。
 * verify 前は要素は unverified で、アプリのコード確認に成功して初めて有効化される。
 */
export const enrollTotpFactor = async (): Promise<ActionResult<EnrollPayload>> => {
    const supabase = await createClient();

    /**
     * 途中離脱で残った未検証要素を先に片付ける。残っていると friendly name 重複で
     * enroll が 422 になり、ユーザーは二度と設定を始められなくなる
     */
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const staleFactors = (factors?.all ?? []).filter((factor) => factor.status !== 'verified');
    await Promise.all(staleFactors.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })));

    const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: TOTP_ISSUER,
        friendlyName: TOTP_FRIENDLY_NAME,
    });
    if (error || !data) {
        return actionFailure('認証アプリの設定を開始できませんでした。時間をおいて再度お試しください');
    }

    return actionSuccess<EnrollPayload>({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
};

/**
 * 認証アプリに表示されたコードを検証し、2 要素認証を有効化する（FR-009）。
 * TOTP は SMS と違い送信工程が無いので challenge と verify を一括で行う。
 */
export const verifyTotpFactor = async (factorId: string, code: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return toVerifyFailure(error);

    return actionSuccess();
};

/** 2 要素認証を無効化する（FR-014）。以後のログインで 2 段階目を求めない */
export const disableTotpFactor = async (factorId: string): Promise<ActionResult> => {
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

    const verified = (data.totp ?? []).find((factor) => factor.status === 'verified');
    if (verified) {
        return { enabled: true, factorId: verified.id };
    }

    return { enabled: false, factorId: null };
};

/**
 * ログイン 2 段階目のコードを検証し、成功したら AAL2 に昇格して TOP（`/`）へ進む（FR-010/011）。
 * 誤り・期限切れコードは拒否して再入力させる。試行回数はレート制限で保護する（FR-013）。
 */
export const verifyLogin = async (factorId: string, code: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return toVerifyFailure(error);

    redirect('/');
};
