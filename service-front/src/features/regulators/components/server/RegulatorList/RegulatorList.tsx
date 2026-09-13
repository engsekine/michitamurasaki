import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Regulator } from '@/features/regulators/types';
import { buttonVariants } from '@/shared/components/ui/Button';
import { formatJstDate } from '@/shared/lib/date';

interface RegulatorListProps {
    regulators: Regulator[];
    /** 各行の操作エリア（編集リンク・削除ボタン等）。ページ側で組み立てて渡す */
    renderActions?: (regulator: Regulator) => ReactNode;
}

interface RegulatorCardProps {
    regulator: Regulator;
    actions?: ReactNode;
}

const RegulatorCard = ({ regulator, actions }: RegulatorCardProps) => {
    return (
        <article className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-base text-foreground">
                    {regulator.brand} {regulator.model}
                </h2>
                {regulator.isPrimary && (
                    <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-primary text-xs">
                        メイン機材
                    </span>
                )}
            </div>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
                <div className="flex items-center gap-1">
                    <dt className="font-medium">前回 OH 日</dt>
                    <dd>{formatJstDate(regulator.lastOverhauledOn)}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <dt className="font-medium">OH 周期</dt>
                    <dd>
                        {regulator.overhaulIntervalMonths} ヶ月 / {regulator.overhaulIntervalDives} 本
                    </dd>
                </div>
            </dl>
            {regulator.notes !== null && regulator.notes !== '' && (
                <p className="text-muted-foreground text-sm">{regulator.notes}</p>
            )}
            {actions !== undefined && <div className="flex items-center justify-end gap-2">{actions}</div>}
        </article>
    );
};

export const RegulatorList = ({ regulators, renderActions }: RegulatorListProps) => {
    // FR-013: レギュレーター未登録時は OH 期限通知の案内と登録導線（CTA）を表示する
    if (regulators.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border border-dashed bg-background p-12 text-center">
                <p className="text-muted-foreground">レギュレーターを登録すると OH 期限をお知らせします</p>
                <Link href="/settings/equipment/new" className={buttonVariants({ variant: 'default' })}>
                    レギュレーターを登録する
                </Link>
            </div>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {regulators.map((regulator) => (
                <li key={regulator.id}>
                    <RegulatorCard regulator={regulator} actions={renderActions?.(regulator)} />
                </li>
            ))}
        </ul>
    );
};
