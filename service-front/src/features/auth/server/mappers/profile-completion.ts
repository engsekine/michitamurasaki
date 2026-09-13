import type { Database } from '@repo/supabase';

import { CURRENT_TERMS_VERSION } from '@/shared/constants/terms';

import type { CompleteProfileInput } from '../actions';

type UserDetailsInsert = Database['public']['Tables']['user_details']['Insert'];

/**
 * ドメイン型 → user_details の INSERT ペイロード（snake_case）への変換。
 * Google ログイン初回の補完で本人行を新規作成するために使う。
 * user_id は呼び出し側が auth.uid() から渡す（クライアント入力を使わない）。
 * 利用規約同意（018）は terms_version / terms_agreed_at を必ず両方セットする（CHECK 充足）。
 */
export const toUserDetailsInsert = (userId: string, input: CompleteProfileInput): UserDetailsInsert => ({
    user_id: userId,
    last_name: input.lastName,
    first_name: input.firstName,
    last_name_romaji: input.lastNameRomaji,
    first_name_romaji: input.firstNameRomaji,
    nickname: input.nickname,
    handle: input.handle,
    birth_on: input.birthOn,
    gender: input.gender,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    terms_version: CURRENT_TERMS_VERSION,
    terms_agreed_at: new Date().toISOString(),
    // ダイバー種別/番号（019）。番号は instructor のときのみ保持（CHECK ③整合）
    diver_type: input.diverType,
    diver_number: input.diverType === 'instructor' ? (input.diverNumber ?? null) : null,
    // メール配信許可（022）。許可時のみ日時を記録し、不許可は NULL（CHECK 充足）。
    is_email_opted_in: input.emailOptIn,
    email_opted_in_at: input.emailOptIn ? new Date().toISOString() : null,
});
