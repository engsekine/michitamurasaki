'use client';

import { useState, useTransition } from 'react';
import type { LogCreditPack } from '@/features/credits/constants';
import { createCheckoutSession } from '@/features/credits/server/actions';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/Button';

interface PurchasePackCardProps {
    /** 表示するパック定義（LOG_CREDIT_PACKS の 1 要素をサーバー側から注入する） */
    pack: LogCreditPack;
}

/**
 * ログパックの購入カード（026 / FR-005）。
 * 「購入する」で選択パックの Checkout Session を作成し、Stripe のホスト型決済ページへ
 * フルページリダイレクトする。価格・数量は表示専用（サーバー定数由来）で、
 * サーバーへは packId のみ渡す
 */
export const PurchasePackCard = ({ pack }: PurchasePackCardProps) => {
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    const unitPriceJpy = Math.round(pack.amountJpy / pack.quantity);
    const headingId = `purchase-pack-${pack.id}-heading`;

    const handlePurchase = (): void => {
        setServerError(null);
        startTransition(async () => {
            const result = await createCheckoutSession(pack.id);
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            // Stripe Checkout はホスト型ページのためフルページ遷移する
            window.location.href = result.url;
        });
    };

    return (
        <section
            aria-labelledby={headingId}
            className={cn(
                'flex flex-col gap-3 rounded-lg border border-border bg-background p-6',
                // おすすめカードのアクセントは枠線で表す（着色背景はコントラスト AA 未達のため使わない）
                pack.isRecommended && 'border-2 border-primary/50',
            )}
        >
            <div className="flex items-center gap-2">
                <h2 id={headingId} className="font-semibold text-lg">
                    {pack.displayName}
                </h2>
                {pack.isRecommended && (
                    <span className="rounded-full border border-primary/50 px-2 py-0.5 font-semibold text-primary text-xs">
                        おすすめ
                    </span>
                )}
            </div>
            <p className="text-muted-foreground text-sm">
                ログ枠を {pack.quantity} 枠まとめて追加できます。買い切りで有効期限はありません。
            </p>
            <p className="flex items-baseline gap-2">
                <span className="font-bold text-2xl">¥{pack.amountJpy.toLocaleString('ja-JP')}</span>
                <span className="text-muted-foreground text-sm">{unitPriceJpy} 円/ログ</span>
                {pack.discountLabel && <span className="font-semibold text-primary text-sm">{pack.discountLabel}</span>}
            </p>
            {serverError && (
                <div role="alert" className="text-red-600 text-sm">
                    {serverError}
                </div>
            )}
            <Button type="button" onClick={handlePurchase} disabled={isPending} aria-busy={isPending}>
                {isPending ? '手続きを開始しています...' : '購入する'}
            </Button>
        </section>
    );
};
