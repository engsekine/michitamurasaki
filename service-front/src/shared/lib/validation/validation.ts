import { type Schema, ValidationError } from 'yup';

/** 検証結果。成功なら trim・変換済みの values、失敗なら先頭のエラーメッセージ */
export type ValidationResult<T> = { values: T; error?: never } | { values?: never; error: string };

/**
 * Server Action 用の yup サーバー側再検証ヘルパー。
 * Server Action は任意クライアントから直接呼べるため、クライアントの yupResolver に
 * 依存せず DB 書き込み前に必ずスキーマを通す（各 feature の validateXxxInput 共通部）。
 * ValidationError 以外（プログラミングエラー）は握りつぶさず再 throw する。
 */
export const validateWithSchema = async <T>(schema: Schema<T>, input: unknown): Promise<ValidationResult<T>> => {
    try {
        return { values: await schema.validate(input) };
    } catch (error) {
        if (error instanceof ValidationError) return { error: error.message };
        throw error;
    }
};
