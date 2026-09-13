import * as yup from 'yup';

import {
    CONTACT_BODY_MAX_LENGTH,
    CONTACT_EMAIL_MAX_LENGTH,
    CONTACT_NAME_MAX_LENGTH,
    INQUIRY_CATEGORY_VALUES,
} from '../constants';

export const contactSchema = yup.object({
    name: yup
        .string()
        .required('お名前を入力してください')
        .max(CONTACT_NAME_MAX_LENGTH, `お名前は ${CONTACT_NAME_MAX_LENGTH} 文字以内で入力してください`),
    email: yup
        .string()
        .required('メールアドレスを入力してください')
        .email('メールアドレスの形式が正しくありません')
        .max(CONTACT_EMAIL_MAX_LENGTH, `メールアドレスは ${CONTACT_EMAIL_MAX_LENGTH} 文字以内で入力してください`),
    category: yup
        .string()
        .required('お問い合わせ種別を選択してください')
        // 型は string のまま保ちつつ、実行時は 4 値のみ許可（空文字は required で弾かれる）。
        // oneOf に readonly tuple をそのまま渡すと InferType が厳密ユニオンになり、空の初期値を扱えないため string[] にする。
        .oneOf(INQUIRY_CATEGORY_VALUES as unknown as string[], 'お問い合わせ種別を選択してください'),
    body: yup
        .string()
        .required('お問い合わせ内容を入力してください')
        .max(CONTACT_BODY_MAX_LENGTH, `お問い合わせ内容は ${CONTACT_BODY_MAX_LENGTH} 文字以内で入力してください`),
    // ハニーポット（bot 検出用）。人間は入力しない前提で、値があれば送信を破棄する（R-003）
    website: yup.string().default(''),
});

export type ContactFormValues = yup.InferType<typeof contactSchema>;
