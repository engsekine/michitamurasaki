import Link from 'next/link';
import { LOG_CREDIT_PACKS } from '@/features/credits';
import { PurchasePackCard } from '@/features/credits/components/client/PurchasePackCard';
import { CreditBalanceBadge } from '@/features/credits/components/server/CreditBalanceBadge';
import { getPurchaseHistory } from '@/features/credits/server/queries';
import type { PurchaseStatus } from '@/features/credits/types';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';
import { formatJstDateTime } from '@/shared/lib/date';

export const metadata = generatePageMetadata(
    {
        slug: '/settings/log-credits',
        title: 'ログ枠の購入',
        description: 'ログ枠の残数確認・ログパックの購入・購入履歴の確認ができます',
    },
    { noIndex: true },
);

interface LogCreditsPageProps {
    searchParams: Promise<{ checkout?: string }>;
}

const STATUS_LABELS: Record<PurchaseStatus, string> = {
    pending: '処理中',
    completed: '完了',
    failed: '失敗',
    refunded: '返金済み',
};

/** ログ枠の購入・履歴ページ（026 / US2・US3） */
export default async function LogCreditsPage({ searchParams }: LogCreditsPageProps) {
    const { checkout } = await searchParams;
    const purchases = await getPurchaseHistory();

    return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
            <div className="flex items-center justify-between">
                <Heading level={1}>ログ枠の購入</Heading>
                <CreditBalanceBadge />
            </div>

            {checkout === 'success' && (
                <div role="status" className="flex flex-col gap-2 rounded-lg border border-green-300 bg-green-50 p-4">
                    <p className="font-semibold text-green-900">ご購入ありがとうございます</p>
                    <p className="text-green-800 text-sm">
                        残枠への反映まで最大 1
                        分ほどかかることがあります。反映されない場合はページを再読み込みしてください。
                    </p>
                    <Link href="/dives/new" className="text-green-900 text-sm underline">
                        ログ作成に戻る
                    </Link>
                </div>
            )}
            {checkout === 'cancelled' && (
                <div role="status" className="rounded-lg border border-border bg-background p-4 text-sm">
                    購入はキャンセルされました。
                </div>
            )}

            <div className="flex flex-col gap-4">
                {LOG_CREDIT_PACKS.map((pack) => (
                    <PurchasePackCard key={pack.id} pack={pack} />
                ))}
            </div>

            <section aria-labelledby="purchase-history-heading" className="flex flex-col gap-3">
                <h2 id="purchase-history-heading" className="font-semibold text-lg">
                    購入履歴
                </h2>
                {purchases.length === 0 ? (
                    <p className="text-muted-foreground text-sm">購入履歴はまだありません</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b text-left text-muted-foreground">
                                <th scope="col" className="py-2 font-normal">
                                    購入日時
                                </th>
                                <th scope="col" className="py-2 font-normal">
                                    内容
                                </th>
                                <th scope="col" className="py-2 text-right font-normal">
                                    金額
                                </th>
                                <th scope="col" className="py-2 text-right font-normal">
                                    状態
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map((purchase) => (
                                <tr key={purchase.id} className="border-border border-b">
                                    <td className="py-2">{formatJstDateTime(purchase.purchasedAt)}</td>
                                    <td className="py-2">ログ枠 {purchase.quantity}</td>
                                    <td className="py-2 text-right">¥{purchase.amountJpy.toLocaleString('ja-JP')}</td>
                                    <td className="py-2 text-right">{STATUS_LABELS[purchase.status]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}
