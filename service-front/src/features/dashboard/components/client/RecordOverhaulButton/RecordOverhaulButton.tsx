'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';

interface RecordOverhaulButtonProps {
    regulatorId: string;
    /**
     * メンテ完了を記録する Server Action。
     * dashboard → regulators の feature 間直接 import を避けるため、
     * ページ側で regulators feature の recordOverhaul を渡す。
     */
    onRecord: (regulatorId: string) => Promise<{ success: true } | { success: false; error: string }>;
}

export const RecordOverhaulButton = ({ regulatorId, onRecord }: RecordOverhaulButtonProps) => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleOpen = () => {
        setError(null);
        setOpen(true);
    };

    const handleConfirm = () => {
        setError(null);
        startTransition(async () => {
            const result = await onRecord(regulatorId);
            setOpen(false);
            if (!result.success) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <>
            <Button onClick={handleOpen}>メンテ完了を記録</Button>
            {error && (
                <p role="alert" className="text-red-600 text-sm">
                    {error}
                </p>
            )}
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title="メンテ完了を記録しますか？"
                description="前回 OH 日を今日に更新します。よろしいですか？"
                confirmLabel="記録する"
                isPending={isPending}
                onConfirm={handleConfirm}
            />
        </>
    );
};
