import * as yup from 'yup';

/**
 * 複数フォームで共有する yup フィールド定義。
 * バリデーションメッセージの表記ゆれを防ぐため、必ずここから import する。
 */

/**
 * 利用規約への同意（018-terms-agreement）。新規登録フォームで使う。
 * 未チェック（false）はバリデーションエラーとし、登録させない。
 */
export const agreedToTermsField = yup
    .boolean()
    .oneOf([true], '利用規約に同意してください')
    .required('利用規約に同意してください');

/**
 * メール配信許可（022-email-consent）。新規登録・プロフィール編集フォームで使う。
 * オプトイン（任意）のため、利用規約同意（agreedToTermsField）と異なり oneOf は付けない。
 * 未チェック（false）でも通し、デフォルトは false（明示的な許可のみ true）。
 */
export const emailOptInField = yup.boolean().default(false);

export const emailField = yup
    .string()
    .email('正しいメールアドレスを入力してください')
    .required('メールアドレスを入力してください');

/**
 * サインアップ・パスワードリセットで使う新規パスワード。
 * 方針は「長さ重視（NIST SP 800-63B 準拠）」＋ 英大文字・英小文字・数字の必須化。
 * - 最小 12 文字: Google(Chrome) / iCloud の自動生成パスワード（15〜20 文字）は通過する
 * - 最大 72 文字: Supabase Auth(GoTrue) が bcrypt の都合で 72 文字超を拒否するため、
 *   クライアント側でも同じ上限を設けてサーバーとの不整合を防ぐ
 * - 英大小 + 数字を必須（Supabase の password_requirements = "lower_upper_letters_digits" と一致）。
 *   Chrome / iCloud の生成パスワードはいずれも英大小と数字を含むため通過する。
 * 記号は必須にしない（Chrome 生成パスワードは記号を含まないことがあるため）。
 */
export const passwordField = yup
    .string()
    .min(12, 'パスワードは12文字以上で入力してください')
    .max(72, 'パスワードは72文字以内で入力してください')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: 'パスワードは英大文字・英小文字・数字をそれぞれ含めてください',
        excludeEmptyString: true,
    })
    .required('パスワードを入力してください');

/** `password` フィールドとの一致を検証する確認用フィールド */
export const passwordConfirmField = yup
    .string()
    .oneOf([yup.ref('password')], 'パスワードが一致しません')
    .required('確認用パスワードを入力してください');
