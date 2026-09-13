import { ResetPasswordForm } from '@/features/auth';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/reset-password',
        title: 'パスワードリセット',
        description: 'パスワードのリセットメールを送信します',
    },
    { noIndex: true },
);

export default function ResetPasswordPage() {
    return (
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
            <Heading level={1}>パスワードリセット</Heading>
            <p className="text-muted-foreground text-sm">
                登録済みのメールアドレスを入力してください。リセット用のリンクをお送りします。
            </p>
            <ResetPasswordForm />
        </div>
    );
}
