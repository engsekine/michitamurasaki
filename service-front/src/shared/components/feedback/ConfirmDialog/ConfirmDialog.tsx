'use client';

import { Button } from '@/shared/components/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/Dialog';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** 取り消し不能・破壊的操作なら true（実行ボタンを destructive 表示に） */
    destructive?: boolean;
    isPending?: boolean;
    onConfirm: () => void;
}

/**
 * 破壊的操作の確認ダイアログ（admin-front の同名コンポーネントと同一 API）。
 * @repo/ui の Dialog により role="dialog"・フォーカストラップ・Esc クローズ・
 * トリガーへのフォーカス復帰を満たす（accessibility.md / WCAG 2.1）。
 */
export const ConfirmDialog = ({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'OK',
    cancelLabel = 'キャンセル',
    destructive = false,
    isPending = false,
    onConfirm,
}: ConfirmDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                    {cancelLabel}
                </Button>
                <Button
                    variant={destructive ? 'destructive' : 'default'}
                    onClick={onConfirm}
                    disabled={isPending}
                    aria-busy={isPending}
                >
                    {isPending ? '処理中...' : confirmLabel}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);
