'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';

import type { DiverType } from '@/shared/constants/diver-type';
import type { Gender } from '@/shared/constants/gender';
import { CURRENT_TERMS_VERSION } from '@/shared/constants/terms';
import { requireUser } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';
import { validateWithSchema } from '@/shared/lib/validation';
import { passwordField } from '@/shared/schemas/fields';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

import { toUserDetailsInsert } from './mappers/profile-completion';

/** 認証メール・OAuth の戻り先ベース URL（'use server' のため非公開ヘルパーとして共有） */
const getSiteUrl = (): string => process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://localhost:3000';

/** signUp の成功ペイロード */
export interface SignUpPayload {
    /** 確認メールを送信した場合 true（ユーザーはまだログインしていない） */
    needsEmailConfirmation: boolean;
}

export interface SignUpInput {
    email: string;
    password: string;
    lastName: string;
    firstName: string;
    lastNameRomaji: string;
    firstNameRomaji: string;
    nickname: string;
    /** ユーザー ID（034。プロフィール URL の識別子。小文字英数字と - _） */
    handle: string;
    /** ISO 8601 date string (YYYY-MM-DD) */
    birthOn: string;
    gender: Gender;
    /** 身長（cm）。任意入力 */
    heightCm: number | null;
    /** 体重（kg）。任意入力 */
    weightKg: number | null;
    /** 利用規約への同意（018）。true 必須 */
    agreedToTerms: boolean;
    /** ダイバー種別（019）。登録時必須 */
    diverType: DiverType;
    /** ダイバー番号（019）。インストラクターのみ・任意 */
    diverNumber: string | null;
    /** メール配信許可（022）。任意（オプトイン） */
    emailOptIn: boolean;
}

/** Google ログイン初回の補完で受け取るプロフィール（メール/パスワードを除く） */
export type CompleteProfileInput = Omit<SignUpInput, 'email' | 'password'>;

export const signIn = async (email: string, password: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return actionFailure('メールアドレスまたはパスワードが間違っています');
    }

    redirect('/');
};

export const signUp = async (input: SignUpInput): Promise<ActionResult<SignUpPayload>> => {
    /** クライアントの無効化に依存せず、サーバー側でも未同意を拒否する（018 / FR-008） */
    if (input.agreedToTerms !== true) {
        return actionFailure('利用規約に同意してください');
    }

    const supabase = await createClient();

    /** nickname 一意制約（user_details_nickname_key）に触れる前に事前チェックし、親切なエラーを返す */
    const { data: nicknameTaken } = await supabase.rpc('is_nickname_taken', { p_nickname: input.nickname });
    if (nicknameTaken) {
        return actionFailure('このニックネームは既に使われています。別のニックネームをお試しください');
    }

    /** ユーザー ID の一意制約（034）も同様に事前チェックする */
    const { data: handleTaken } = await supabase.rpc('is_handle_taken', { p_handle: input.handle });
    if (handleTaken) {
        return actionFailure('このユーザー ID は既に使われています。別のユーザー ID をお試しください');
    }

    const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
            emailRedirectTo: `${getSiteUrl()}/api/auth/callback?next=/`,
            /**
             * raw_user_meta_data に格納され、handle_new_user トリガーが
             * user_details への INSERT で参照する。
             */
            data: {
                last_name: input.lastName,
                first_name: input.firstName,
                last_name_romaji: input.lastNameRomaji,
                first_name_romaji: input.firstNameRomaji,
                nickname: input.nickname,
                /** handle_new_user トリガーが user_details.handle に記録する（034） */
                handle: input.handle,
                birth_on: input.birthOn,
                gender: input.gender,
                height_cm: input.heightCm,
                weight_kg: input.weightKg,
                /** handle_new_user トリガーが user_details.terms_version に記録する（018） */
                terms_version: CURRENT_TERMS_VERSION,
                /** ダイバー種別/番号（019）。番号は instructor のときのみトリガーが保存する */
                diver_type: input.diverType,
                diver_number: input.diverType === 'instructor' ? input.diverNumber : null,
                /** handle_new_user トリガーが user_details.is_email_opted_in に記録する（022） */
                email_opt_in: input.emailOptIn,
            },
        },
    });

    if (error) {
        console.error('[signUp] supabase error:', {
            message: error.message,
            status: error.status,
            code: error.code,
            name: error.name,
        });
        if (error.message.includes('already registered')) {
            return actionFailure('このメールアドレスは既に登録されています');
        }
        return actionFailure('サインアップに失敗しました。時間をおいて再度お試しください');
    }

    /**
     * enable_confirmations = true の場合、session は null で identities は空配列。
     * ただし「既に登録済みのメール」でも Supabase は同じ形のレスポンスを返すため、
     * identities が空のときは情報漏洩防止のメッセージを差し戻す。
     */
    if (data.user && data.user.identities?.length === 0) {
        return actionFailure('このメールアドレスは既に登録されています');
    }

    return actionSuccess<SignUpPayload>({ needsEmailConfirmation: true });
};

export const signOut = async (): Promise<void> => {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
};

export const requestPasswordReset = async (email: string): Promise<ActionResult> => {
    const supabase = await createClient();

    /**
     * 登録済みかどうかに関わらず成功扱い（情報漏洩防止）。
     * リセットリンクは callback 経由で新パスワード設定ページへ誘導する（001 / FR-019）
     */
    await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteUrl()}/api/auth/callback?next=/update-password`,
    });

    return actionSuccess();
};

/**
 * リセットリンク経由で新しいパスワードを設定する（001 / US4-3 / FR-019）。
 * リカバリーセッション（リセットメール → callback で確立）を前提とし、
 * 更新成功後はサインアウトして /login へ誘導する（新パスワードで明示的に再ログインさせる）。
 */
export const updatePassword = async (password: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return actionFailure('セッションが無効です。リセットメールのリンクからやり直してください');
    }

    /** クライアントの yupResolver に依存せず、サーバー側でもパスワード要件を再検証する */
    const validated = await validateWithSchema(passwordField, password);
    if (validated.error !== undefined) return actionFailure(validated.error);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
        if (/different from the old password|same.*password/i.test(error.message)) {
            return actionFailure('現在と同じパスワードは設定できません。別のパスワードを入力してください');
        }
        console.error('[updatePassword] supabase error:', {
            message: error.message,
            status: error.status,
        });
        return actionFailure('パスワードの更新に失敗しました。時間をおいて再度お試しください');
    }

    await supabase.auth.signOut();
    redirect('/login');
};

/**
 * サインアップ確認メールを再送する（023 / FR-004）。
 * 未確認ユーザーがメールを紛失・未達だった場合の再送導線から呼ばれる。
 * ユーザー列挙を防ぐため、レート制限以外の失敗は成功と同じ見え方にする（詳細を返さない）。
 */
export const resendConfirmationEmail = async (email: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
            emailRedirectTo: `${getSiteUrl()}/api/auth/callback?next=/`,
        },
    });

    /** レート制限（FR-005）のみユーザーに明示し、それ以外は情報漏洩防止のため成功扱いにする */
    if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
        return actionFailure('確認メールの再送は、しばらく時間をおいてから再度お試しください');
    }

    return actionSuccess();
};

/**
 * Google OAuth ログインを開始する（016-google-login）。
 * 成功時は Google の同意画面 URL へリダイレクトする（関数は戻らない）。
 * 戻り先（/api/auth/callback）は既存のメール認証コールバックと共通。
 */
export const signInWithGoogle = async (): Promise<ActionResult> => {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${getSiteUrl()}/api/auth/callback?next=/`,
        },
    });

    if (error || !data.url) {
        return actionFailure('Google ログインを開始できませんでした。時間をおいて再度お試しください');
    }

    /** Supabase が発行する外部 authorize URL のため typedRoutes の静的検証対象外（cast が必要） */
    redirect(toBrowserReachableAuthorizeUrl(data.url) as Route);
};

/**
 * Server Action は SUPABASE_INTERNAL_URL（Docker 内 `host.docker.internal`）で
 * Supabase に接続するため、signInWithOAuth が返す authorize URL もその内部ホストになる。
 * しかしこの URL はブラウザが遷移する先なので、ブラウザから解決可能な
 * NEXT_PUBLIC_SUPABASE_URL（`127.0.0.1` 等）へオリジンを差し替える。
 * 両 env が未設定/同一の本番環境では何もしない。
 */
const toBrowserReachableAuthorizeUrl = (authorizeUrl: string): string => {
    const internalUrl = process.env['SUPABASE_INTERNAL_URL'];
    const publicUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    if (!internalUrl || !publicUrl) return authorizeUrl;

    const internalOrigin = new URL(internalUrl).origin;
    const publicOrigin = new URL(publicUrl).origin;
    if (internalOrigin === publicOrigin) return authorizeUrl;

    return authorizeUrl.startsWith(internalOrigin)
        ? `${publicOrigin}${authorizeUrl.slice(internalOrigin.length)}`
        : authorizeUrl;
};

/**
 * Google ログイン初回ユーザーのプロフィールを補完し、user_details に本人行を INSERT する。
 * user_id はクライアント入力ではなく auth.uid()（セッションユーザー）を使う。
 * 補完済みユーザーの再送（一意制約違反）は冪等に TOP（`/`）へ流す。
 */
export const completeProfile = async (input: CompleteProfileInput): Promise<ActionResult> => {
    /** クライアントの無効化に依存せず、サーバー側でも未同意を拒否する（018 / FR-008） */
    if (input.agreedToTerms !== true) {
        return actionFailure('利用規約に同意してください');
    }

    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    /** nickname 一意制約に触れる前に事前チェックし、親切なエラーを返す */
    const { data: nicknameTaken } = await supabase.rpc('is_nickname_taken', {
        p_nickname: input.nickname,
        p_exclude_user_id: user.id,
    });
    if (nicknameTaken) {
        return actionFailure('このニックネームは既に使われています。別のニックネームをお試しください');
    }

    /** ユーザー ID の一意制約（034）も同様に事前チェックする */
    const { data: handleTaken } = await supabase.rpc('is_handle_taken', {
        p_handle: input.handle,
        p_exclude_user_id: user.id,
    });
    if (handleTaken) {
        return actionFailure('このユーザー ID は既に使われています。別のユーザー ID をお試しください');
    }

    const { error } = await supabase.from('user_details').insert(toUserDetailsInsert(user.id, input));

    if (error) {
        /** nickname 一意制約違反（競合時のフォールバック）は「補完済み」と混同せずエラーを返す */
        if (error.code === '23505' && error.message.includes('user_details_nickname_key')) {
            return actionFailure('このニックネームは既に使われています。別のニックネームをお試しください');
        }
        /** handle 一意制約違反（034。競合時のフォールバック） */
        if (error.code === '23505' && error.message.includes('user_details_handle_key')) {
            return actionFailure('このユーザー ID は既に使われています。別のユーザー ID をお試しください');
        }
        /** 既に補完済み（PK user_id 重複）の場合は冪等に成功扱いとし TOP へ */
        if (error.code === '23505') {
            redirect('/');
        }
        console.error('[completeProfile] supabase error:', {
            message: error.message,
            code: error.code,
        });
        return actionFailure('プロフィールの保存に失敗しました。時間をおいて再度お試しください');
    }

    /**
     * ヘッダー（AuthNav）がユーザー ID の URL を生成できるよう metadata に同期する（034）。
     * 同期失敗は致命的でない（内部 ID URL → ページ側転送で正規化される）ため成功扱いにする。
     */
    const { error: metadataError } = await supabase.auth.updateUser({ data: { handle: input.handle } });
    if (metadataError) {
        console.error('[completeProfile] auth metadata sync error:', { message: metadataError.message });
    }

    redirect('/');
};
