'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { GoogleAuthButton } from '@/features/auth/components/client/GoogleAuthButton';
import { type LoginFormValues, loginSchema } from '@/features/auth/schemas/login.schema';
import { signIn } from '@/features/auth/server/actions';
import { FormField } from '@/shared/components/form';
import { Button } from '@/shared/components/ui/Button';

interface LoginFormProps {
    /** コールバックの error クエリに対応する表示用メッセージ（016-google-login） */
    initialError?: string | undefined;
}

export const LoginForm = ({ initialError }: LoginFormProps = {}) => {
    const [isPending, startTransition] = useTransition();

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: yupResolver(loginSchema),
    });

    const onSubmit = handleSubmit((values) => {
        startTransition(async () => {
            /** 成功時は signIn 内で redirect されるため、戻り値を受け取るのは失敗時のみ */
            const result = await signIn(values.email, values.password);
            if (!result.success) {
                setError('root', { message: result.error });
            }
        });
    });

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {initialError && (
                <div role="alert" className="text-red-600 text-sm">
                    {initialError}
                </div>
            )}

            <FormField
                id="email"
                label="メールアドレス"
                type="email"
                autoComplete="email"
                aria-required="true"
                error={errors.email?.message}
                {...register('email')}
            />

            <FormField
                id="password"
                label="パスワード"
                type="password"
                autoComplete="current-password"
                aria-required="true"
                error={errors.password?.message}
                {...register('password')}
            />

            {errors.root && (
                <div role="alert" className="text-red-600 text-sm">
                    {errors.root.message}
                </div>
            )}

            <Button type="submit" disabled={isPending} aria-busy={isPending}>
                {isPending ? 'ログイン中...' : 'ログイン'}
            </Button>

            <div className="flex items-center gap-3 text-muted-foreground text-xs">
                <span className="h-px flex-1 bg-border" />
                または
                <span className="h-px flex-1 bg-border" />
            </div>

            <GoogleAuthButton label="Google でログイン" />

            <div className="flex flex-col gap-2 text-muted-foreground text-sm">
                <Link href="/signup" className="underline hover:text-foreground">
                    新規登録はこちら
                </Link>
                <Link href="/reset-password" className="underline hover:text-foreground">
                    パスワードを忘れた方
                </Link>
            </div>
        </form>
    );
};
