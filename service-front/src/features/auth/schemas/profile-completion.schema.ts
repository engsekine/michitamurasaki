import * as yup from 'yup';

import { requiredDiverFields } from '@/shared/schemas/diver';
import { agreedToTermsField, emailOptInField } from '@/shared/schemas/fields';
import { userProfileFields } from '@/shared/schemas/user-profile';

/**
 * Google ログイン初回時のプロフィール補完フォーム（016-google-login）。
 * メール / パスワードは持たないため、共有の userProfileFields のみで構成する。
 * バリデーション基準は 001-auth のサインアップ・account のプロフィール編集と同一。
 * 新規登録時の利用規約同意（018）も必須とする。メール配信許可（022）は任意。
 */
export const profileCompletionSchema = yup.object({
    ...userProfileFields,
    ...requiredDiverFields,
    agreedToTerms: agreedToTermsField,
    emailOptIn: emailOptInField,
});

export type ProfileCompletionFormValues = yup.InferType<typeof profileCompletionSchema>;
