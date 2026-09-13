'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { type ResetPasswordFormValues, resetPasswordSchema } from '@/features/auth/schemas/reset.schema';
import { updatePassword } from '@/features/auth/server/actions';
import { FormField } from '@/shared/components/form';
import { Button } from '@/shared/components/ui/Button';

/**
 * リセットリンク経由の新パスワード設定フォーム（001 / US4-3 / FR-019）。
 * 成功時はサーバーアクションが signOut → /login へ redirect するため、このフォームには戻らない。
 */
export const UpdatePasswordForm = () => {
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetPasswordFormValues>({
        resolver: yupResolver(resetPasswordSchema),
    });

    const onSubmit = handleSubmit((values) => {
        setServerError(null);
        startTransition(async () => {
            const result = await updatePassword(values.password);
            /** 成功時はサーバー側 redirect のためここには来ない。到達するのは失敗時のみ */
            if (!result.success) {
                setServerError(result.error);
            }
        });
    });

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FormField
                id="password"
                label="新しいパスワード"
                type="password"
                autoComplete="new-password"
                aria-required="true"
                error={errors.password?.message}
                {...register('password')}
            />
            <FormField
                id="passwordConfirm"
                label="新しいパスワード（確認）"
                type="password"
                autoComplete="new-password"
                aria-required="true"
                error={errors.passwordConfirm?.message}
                {...register('passwordConfirm')}
            />

            <Button type="submit" disabled={isPending} aria-busy={isPending}>
                {isPending ? '設定中...' : 'パスワードを設定する'}
            </Button>

            {serverError && (
                <div role="alert" className="text-red-600 text-sm">
                    {serverError}
                </div>
            )}
        </form>
    );
};
