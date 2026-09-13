import { LoginForm, ResendConfirmationButton } from '@/features/auth';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/login',
        title: 'ログイン',
        description: 'ダイビングログにログインします',
    },
    { noIndex: true },
);

/** コールバックの error クエリ → ユーザー向けメッセージ（016-google-login） */
const ERROR_MESSAGES: Record<string, string> = {
    oauth_cancelled: 'Google ログインがキャンセルされました。もう一度お試しください。',
    auth_callback_failed: 'ログインに失敗しました。時間をおいて再度お試しください。',
    email_not_verified: 'メールアドレスの確認が完了していません。確認のうえ再度お試しください。',
};

interface LoginPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const { error } = await searchParams;
    const errorKey = Array.isArray(error) ? error[0] : error;
    const initialError = errorKey ? ERROR_MESSAGES[errorKey] : undefined;
    const isEmailNotVerified = errorKey === 'email_not_verified';

    return (
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
            <Heading level={1}>ログイン</Heading>
            <LoginForm initialError={initialError} />
            {isEmailNotVerified && (
                <section className="flex flex-col gap-2 border-border border-t pt-6">
                    <h2 className="font-medium text-sm">確認メールが届いていませんか？</h2>
                    <p className="text-muted-foreground text-sm">
                        登録したメールアドレスを入力すると、確認メールを再送できます。
                    </p>
                    <ResendConfirmationButton />
                </section>
            )}
        </div>
    );
}
