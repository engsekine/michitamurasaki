'use client';

import { FileText } from 'lucide-react';
import { type ComponentPropsWithRef, type UIEvent, useState } from 'react';
import { TermsContent } from '@/features/terms';
import { FormCheckbox } from '@/shared/components/form';
import { buttonVariants } from '@/shared/components/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/shared/components/ui/Dialog';

import { isScrolledToBottom } from './isScrolledToBottom';

interface TermsAgreementFieldProps extends ComponentPropsWithRef<'input'> {
    /** input と label の関連付け */
    id: string;
    error?: string | undefined;
}

/**
 * 利用規約をモーダルで表示し、最後までスクロールするまで同意チェックを無効化するフィールド（018）。
 * チェックボックス自体は `agreedToTerms` として react-hook-form の `register` をスプレッドして接続する。
 * 「読む」操作を経ないと同意できないようにすることで、実質的な未読同意を防ぐ。
 */
export const TermsAgreementField = ({ id, error, ...inputProps }: TermsAgreementFieldProps) => {
    /** モーダルを最後までスクロールした（＝読み終えた）か。これが false の間はチェック不可 */
    const [hasRead, setHasRead] = useState(false);

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        if (isScrolledToBottom(event.currentTarget)) {
            setHasRead(true);
        }
    };

    /** 開いた時点でスクロール不要な高さなら即「読み終えた」扱いにする（永久に無効化されるのを防ぐ） */
    const handleScrollRef = (node: HTMLDivElement | null) => {
        if (node && isScrolledToBottom(node)) {
            setHasRead(true);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <Dialog>
                <DialogTrigger className={buttonVariants({ variant: 'secondary', className: 'w-full' })}>
                    <FileText aria-hidden="true" />
                    利用規約を読む
                </DialogTrigger>
                <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>利用規約</DialogTitle>
                        <DialogDescription>最後までお読みいただくと、同意のチェックができます。</DialogDescription>
                    </DialogHeader>
                    <div
                        ref={handleScrollRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto rounded-md border border-border p-4"
                        data-testid="terms-scroll-area"
                    >
                        <TermsContent />
                    </div>
                    {!hasRead && (
                        <DialogFooter>
                            <p className="text-muted-foreground text-sm" role="status">
                                最後までスクロールすると同意できます
                            </p>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            <FormCheckbox
                id={id}
                label="利用規約に同意する"
                required
                disabled={!hasRead}
                error={error}
                {...inputProps}
            />
            {!hasRead && (
                <p className="text-muted-foreground text-xs">
                    「利用規約を読む」を開き、最後までお読みいただくと同意できます。
                </p>
            )}
        </div>
    );
};
