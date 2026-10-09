import * as yup from 'yup';

/** 認証アプリ（TOTP）ワンタイムコードの桁数。TOTP は RFC 6238 の既定どおり 6 桁固定 */
export const OTP_LENGTH = 6;

/** ワンタイムコードの形式（OTP_LENGTH 桁の数字） */
export const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

export const otpSchema = yup.object({
    code: yup
        .string()
        .required('確認コードを入力してください')
        .matches(OTP_PATTERN, `${OTP_LENGTH} 桁の数字を入力してください`),
});

export type OtpFormValues = yup.InferType<typeof otpSchema>;
