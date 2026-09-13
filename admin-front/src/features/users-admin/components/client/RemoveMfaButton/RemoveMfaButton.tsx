'use client';

import { Button } from '@repo/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { removeMfaFactor } from '@/features/users-admin/server/actions';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';

interface RemoveMfaButtonProps {
    userId: string;
}

/**
 * 対象ユーザーの 2 要素認証を解除する（確認付き）（023 / FR-016）。
 * 電話紛失・番号変更時のリカバリー操作。破壊的操作のため確認ダイアログを挟み、
 * 成功時は状態を再取得（refresh）、失敗時は inline alert で通知する。
 */
export const RemoveMfaButton = ({ userId }: RemoveMfaButtonProps) => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onConfirm = () => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
            const result = await removeMfaFactor(userId);
            setOpen(false);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setMessage('2 要素認証を解除しました。');
            router.refresh();
        });
    };

    return (
        <div className="flex items-center gap-3">
            <Button
                variant="outline"
                size="sm"
                onClick={() => {
                    setError(null);
                    setMessage(null);
                    setOpen(true);
                }}
            >
                2 要素認証を解除
            </Button>
            {message && (
                <span role="status" className="text-green-700 text-xs">
                    {message}
                </span>
            )}
            {error && (
                <span role="alert" className="text-red-600 text-xs">
                    {error}
                </span>
            )}
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title="2 要素認証を解除"
                description="このユーザーの 2 要素認証（電話番号）を解除します。解除後はパスワード（または Google）のみでログインできるようになります。よろしいですか？"
                confirmLabel="解除する"
                destructive
                isPending={isPending}
                onConfirm={onConfirm}
            />
        </div>
    );
};
