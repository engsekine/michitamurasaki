'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { type ResetPasswordRequestFormValues, resetPasswordRequestSchema } from '@/features/auth/schemas/reset.schema';
import { requestPasswordReset } from '@/features/auth/server/actions';
import { FormField } from '@/shared/components/form';
import { Button } from '@/shared/components/ui/Button';

export const ResetPasswordForm = () => {
    const [isPending, startTransition] = useTransition();
    const [submitted, setSubmitted] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetPasswordRequestFormValues>({
        resolver: yupResolver(resetPasswordRequestSchema),
    });

    const onSubmit = handleSubmit((values) => {
        startTransition(async () => {
            await requestPasswordReset(values.email);
            setSubmitted(true);
        });
    });

    if (submitted) {
        return (
            <div role="status" aria-live="polite" className="flex flex-col gap-4">
                <p className="text-sm">
                    入力されたメールアドレス宛にリセット用のリンクを送信しました。
                    メールに記載されたリンクから新しいパスワードを設定してください。
                </p>
                <Link href="/login" className="text-sm underline hover:text-foreground">
                    ログイン画面に戻る
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FormField
                id="email"
                label="メールアドレス"
                type="email"
                autoComplete="email"
                aria-required="true"
                error={errors.email?.message}
                {...register('email')}
            />

            <Button type="submit" disabled={isPending} aria-busy={isPending}>
                {isPending ? '送信中...' : 'リセットリンクを送信'}
            </Button>

            <Link href="/login" className="text-muted-foreground text-sm underline hover:text-foreground">
                ログイン画面に戻る
            </Link>
        </form>
    );
};
