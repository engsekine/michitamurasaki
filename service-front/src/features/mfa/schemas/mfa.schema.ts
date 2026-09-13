import * as yup from 'yup';

/** 電話番号は E.164 国際形式（例: +819012345678）。先頭 + と 8〜15 桁の数字 */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** SMS ワンタイムコードの桁数（config.toml [auth.mfa.phone] otp_length と一致させる） */
export const OTP_LENGTH = 6;

/** SMS ワンタイムコードの形式（OTP_LENGTH 桁の数字） */
export const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

export const phoneSchema = yup.object({
    phone: yup
        .string()
        .required('電話番号を入力してください')
        .matches(E164_PATTERN, '国際形式（例: +819012345678）で入力してください'),
});

export type PhoneFormValues = yup.InferType<typeof phoneSchema>;

export const otpSchema = yup.object({
    code: yup
        .string()
        .required('確認コードを入力してください')
        .matches(OTP_PATTERN, `${OTP_LENGTH} 桁の数字を入力してください`),
});

export type OtpFormValues = yup.InferType<typeof otpSchema>;
