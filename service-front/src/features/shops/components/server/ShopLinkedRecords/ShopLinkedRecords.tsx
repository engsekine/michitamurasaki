import type { Route } from 'next';
import Link from 'next/link';

import type { LinkedDive, LinkedPlan } from '@/features/shops/types';
import { Heading } from '@/shared/components/typography/Heading';
import { formatJstDate } from '@/shared/lib/date';

interface ShopLinkedRecordsProps {
    plans: LinkedPlan[];
    dives: LinkedDive[];
}

/**
 * ショップ詳細の逆引き一覧（033 / FR-016）。
 * このショップに紐付いた予定・ログを表示し、各詳細へたどれるようにする。
 */
export const ShopLinkedRecords = ({ plans, dives }: ShopLinkedRecordsProps) => {
    return (
        <div className="flex flex-col gap-6">
            <section aria-labelledby="shop-linked-plans" className="flex flex-col gap-3">
                <Heading level={2} id="shop-linked-plans">
                    このショップの予定
                </Heading>
                {plans.length === 0 ? (
                    <p className="text-muted-foreground text-sm">紐付いた予定はありません</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {plans.map((plan) => (
                            <li key={plan.id}>
                                <Link
                                    href={`/plans/${plan.id}` as Route}
                                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/50"
                                >
                                    <span className="text-muted-foreground text-sm">
                                        {formatJstDate(plan.plannedOn)}
                                    </span>
                                    <span>{plan.location}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby="shop-linked-dives" className="flex flex-col gap-3">
                <Heading level={2} id="shop-linked-dives">
                    このショップのログ
                </Heading>
                {dives.length === 0 ? (
                    <p className="text-muted-foreground text-sm">紐付いたログはありません</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {dives.map((dive) => (
                            <li key={dive.id}>
                                <Link
                                    href={`/dives/${dive.id}` as Route}
                                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/50"
                                >
                                    <span className="text-muted-foreground text-sm">
                                        {formatJstDate(dive.diveDate)}
                                    </span>
                                    <span>{dive.location || 'ポイント未設定'}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};
