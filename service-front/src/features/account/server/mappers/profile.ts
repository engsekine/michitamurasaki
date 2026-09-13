import type { Database } from '@repo/supabase';

import type { DiverType } from '@/shared/constants/diver-type';
import type { Gender } from '@/shared/constants/gender';

import type { ProfileData, UpdateProfileInput } from '../actions';

type UserDetailsRow = Database['public']['Tables']['user_details']['Row'];
type UserDetailsUpdate = Database['public']['Tables']['user_details']['Update'];

/** getProfile が SELECT する列だけを切り出した Row 型 */
export type ProfileRow = Pick<
    UserDetailsRow,
    | 'last_name'
    | 'first_name'
    | 'last_name_romaji'
    | 'first_name_romaji'
    | 'nickname'
    | 'handle'
    | 'birth_on'
    | 'gender'
    | 'height_cm'
    | 'weight_kg'
    | 'diver_type'
    | 'diver_number'
    | 'is_email_opted_in'
>;

/** DB Row → ドメイン型（camelCase）への変換 */
export const toProfile = (row: ProfileRow, email: string): ProfileData => ({
    email,
    lastName: row.last_name,
    firstName: row.first_name,
    lastNameRomaji: row.last_name_romaji,
    firstNameRomaji: row.first_name_romaji,
    nickname: row.nickname,
    handle: row.handle,
    birthOn: row.birth_on,
    gender: row.gender as Gender,
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    diverType: row.diver_type as DiverType | null,
    diverNumber: row.diver_number,
    emailOptIn: row.is_email_opted_in,
});

/**
 * 配信許可日時（email_opted_in_at）を解決する純関数（022）。
 * 「最初に許可した時点」を保つため、OFF→ON のときだけ新しい日時を採用する。
 * - 不許可（next=false）: NULL（撤回でクリア）
 * - 許可（next=true）かつ 既に許可済みで日時あり: 既存日時を保持
 * - 許可（next=true）かつ 新規許可（OFF→ON）または日時なし: now（呼び出し側が渡す現在時刻）
 */
export const resolveEmailOptedInAt = (
    nextOptIn: boolean,
    currentOptIn: boolean,
    currentOptedInAt: string | null,
    now: string = new Date().toISOString(),
): string | null => {
    if (!nextOptIn) return null;
    if (currentOptIn && currentOptedInAt !== null) return currentOptedInAt;
    return now;
};

/** ドメイン型 → DB Update ペイロード（snake_case）への変換 */
export const toUserDetailsUpdate = (input: UpdateProfileInput, emailOptedInAt: string | null): UserDetailsUpdate => ({
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
    // ダイバー種別/番号（019）。番号は instructor のときのみ保持（一般/未選択は null＝CHECK ③整合）
    diver_type: input.diverType,
    diver_number: input.diverType === 'instructor' ? (input.diverNumber ?? null) : null,
    is_email_opted_in: input.emailOptIn,
    email_opted_in_at: emailOptedInAt,
});
