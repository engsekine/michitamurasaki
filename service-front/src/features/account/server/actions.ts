'use server';

import { revalidatePath } from 'next/cache';

import type { DiverType } from '@/shared/constants/diver-type';
import type { Gender } from '@/shared/constants/gender';
import { requireUser } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

import { resolveEmailOptedInAt, toProfile, toUserDetailsUpdate } from './mappers/profile';

export interface UpdateProfileInput {
    lastName: string;
    firstName: string;
    lastNameRomaji: string;
    firstNameRomaji: string;
    nickname: string;
    /** ユーザー ID（034。プロフィール URL の識別子） */
    handle: string;
    /** ISO 8601 date string (YYYY-MM-DD) */
    birthOn: string;
    gender: Gender;
    /** 身長（cm）。任意入力 */
    heightCm: number | null;
    /** 体重（kg）。任意入力 */
    weightKg: number | null;
    /** ダイバー種別（019）。編集では任意（未選択=null 可） */
    diverType: DiverType | null;
    /** ダイバー番号（019）。インストラクターのみ・任意 */
    diverNumber: string | null;
    /** メール配信許可（022）。任意（オプトイン） */
    emailOptIn: boolean;
}

export interface ProfileData {
    email: string;
    lastName: string;
    firstName: string;
    lastNameRomaji: string;
    firstNameRomaji: string;
    nickname: string;
    /** ユーザー ID（034。プロフィール URL の識別子） */
    handle: string;
    /** ISO 8601 date string (YYYY-MM-DD) */
    birthOn: string;
    gender: Gender;
    /** 身長（cm）。未登録時は null */
    heightCm: number | null;
    /** 体重（kg）。未登録時は null */
    weightKg: number | null;
    /** ダイバー種別（019）。未設定は null */
    diverType: DiverType | null;
    /** ダイバー番号（019）。未設定は null */
    diverNumber: string | null;
    /** メール配信許可（022）。デフォルト false */
    emailOptIn: boolean;
}

export const getProfile = async (): Promise<ProfileData | null> => {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('user_details')
        .select(
            'last_name, first_name, last_name_romaji, first_name_romaji, nickname, handle, birth_on, gender, height_cm, weight_kg, diver_type, diver_number, is_email_opted_in',
        )
        .eq('user_id', user.id)
        .single();

    if (error || !data) {
        console.error('[getProfile] failed to fetch user_details:', error);
        return null;
    }

    return toProfile(data, user.email ?? '');
};

export const updateProfile = async (input: UpdateProfileInput): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    /** nickname 一意制約の事前チェック。自分の現在の nickname は衝突対象から除外する */
    const { data: nicknameTaken } = await supabase.rpc('is_nickname_taken', {
        p_nickname: input.nickname,
        p_exclude_user_id: user.id,
    });
    if (nicknameTaken) {
        return actionFailure('このニックネームは既に使われています。別のニックネームをお試しください');
    }

    /** ユーザー ID の一意制約（034）。自分は衝突対象から除外する */
    const { data: handleTaken } = await supabase.rpc('is_handle_taken', {
        p_handle: input.handle,
        p_exclude_user_id: user.id,
    });
    if (handleTaken) {
        return actionFailure('このユーザー ID は既に使われています。別のユーザー ID をお試しください');
    }

    /**
     * 配信許可日時は「最初に許可した時点」を表す（022）。
     * 現在値を読み、OFF→ON のときだけ now() を新規記録し、ON 維持なら既存日時を保持、
     * ON→OFF（撤回）では NULL にクリアする。クライアント送信値だけに依存しない。
     */
    const { data: current, error: currentError } = await supabase
        .from('user_details')
        .select('is_email_opted_in, email_opted_in_at')
        .eq('user_id', user.id)
        .single();

    if (currentError) {
        console.error('[updateProfile] failed to fetch current email opt-in state:', currentError);
    }

    const emailOptedInAt = resolveEmailOptedInAt(
        input.emailOptIn,
        current?.is_email_opted_in ?? false,
        current?.email_opted_in_at ?? null,
    );

    const { error } = await supabase
        .from('user_details')
        .update(toUserDetailsUpdate(input, emailOptedInAt))
        .eq('user_id', user.id);

    if (error) {
        /** 競合時のフォールバック（一意制約違反） */
        if (error.code === '23505' && error.message.includes('user_details_nickname_key')) {
            return actionFailure('このニックネームは既に使われています。別のニックネームをお試しください');
        }
        if (error.code === '23505' && error.message.includes('user_details_handle_key')) {
            return actionFailure('このユーザー ID は既に使われています。別のユーザー ID をお試しください');
        }
        console.error('[updateProfile] supabase error:', {
            message: error.message,
            code: error.code,
        });
        return actionFailure('プロフィールの更新に失敗しました。時間をおいて再度お試しください');
    }

    /**
     * ヘッダー（AuthNav）のマイプロフィールリンクが最新のユーザー ID の URL を生成できるよう、
     * auth の user_metadata に handle を同期する（034 Rev.2）。
     * 同期失敗は致命的でない（内部 ID URL → ページ側転送で正規化される）ため成功扱いにする。
     */
    const { error: metadataError } = await supabase.auth.updateUser({ data: { handle: input.handle } });
    if (metadataError) {
        console.error('[updateProfile] auth metadata sync error:', { message: metadataError.message });
    }

    revalidatePath('/settings/profile');
    return actionSuccess();
};
