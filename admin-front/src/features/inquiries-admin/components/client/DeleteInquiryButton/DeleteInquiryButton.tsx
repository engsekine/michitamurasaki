'use client';

import { Button } from '@repo/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteInquiry } from '@/features/inquiries-admin/server/actions';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';

interface DeleteInquiryButtonProps {
    id: string;
}

/** お問い合わせの物理削除（確認付き）。失敗時は inline alert で通知し、成功時は一覧へ戻る */
export const DeleteInquiryButton = ({ id }: DeleteInquiryButtonProps) => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onConfirm = () => {
        startTransition(async () => {
            const result = await deleteInquiry(id);
            if (!result.success) {
                setError(result.error);
                setOpen(false);
                return;
            }
            setOpen(false);
            router.push('/inquiries');
            router.refresh();
        });
    };

    return (
        <div className="flex items-center gap-3">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    setError(null);
                    setOpen(true);
                }}
            >
                削除
            </Button>
            {error && (
                <span role="alert" className="text-red-600 text-xs">
                    {error}
                </span>
            )}
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title="お問い合わせを削除"
                description="このお問い合わせを削除します。この操作は取り消せません。よろしいですか？"
                confirmLabel="削除する"
                destructive
                isPending={isPending}
                onConfirm={onConfirm}
            />
        </div>
    );
};
