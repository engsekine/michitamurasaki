import Link from 'next/link';
import type { ReactNode } from 'react';
import type { OverhaulLevel } from '@/features/dashboard/lib/overhaul';
import type { PrimaryRegulatorStatus } from '@/features/dashboard/types';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { formatJstDate } from '@/shared/lib/date';

interface RegulatorPanelProps {
    /** メイン機材の OH ステータス。レギュレーター未登録は null */
    status: PrimaryRegulatorStatus | null;
    /** ページ側で組み立てた RecordOverhaulButton を受け取る slot */
    recordButton?: ReactNode;
}

/** レベル別の表示定義。色だけに依存せず記号 + テキストで識別する（FR-015） */
const LEVEL_DISPLAY: Record<OverhaulLevel, { symbol: string; label: string; className: string }> = {
    ok: { symbol: '●', label: '余裕あり', className: 'bg-blue-100 text-blue-800' },
    warning: { symbol: '▲', label: '期限間近', className: 'bg-yellow-100 text-yellow-800' },
    expired: { symbol: '■', label: '期限切れ', className: 'bg-red-100 text-red-800' },
};

const formatRemainingDays = (remainingDays: number): string => {
    if (remainingDays < 0) return `${-remainingDays}日超過`;
    return `残り${remainingDays}日`;
};

const formatRemainingDives = (remainingDives: number): string => {
    if (remainingDives < 0) return `${-remainingDives}本超過`;
    return `残り${remainingDives}本`;
};

export const RegulatorPanel = ({ status, recordButton }: RegulatorPanelProps) => {
    if (!status) {
        return (
            <section
                aria-labelledby="regulator-panel-empty-heading"
                className="flex flex-col items-start gap-3 rounded-lg border border-border bg-background p-4"
            >
                {/* TopDashboard の h2「レギュレーター OH 状況」配下に置かれるため h3 が正しい階層 */}
                <Heading level={3} id="regulator-panel-empty-heading" className="text-foreground">
                    OH ステータス
                </Heading>
                <p className="text-muted-foreground">レギュレーターを登録すると OH 期限をお知らせします</p>
                <Link href="/settings/equipment" className={buttonVariants()}>
                    レギュレーターを登録する
                </Link>
            </section>
        );
    }

    const { level, nextOverhaulDate, remainingDays, remainingDives } = status.status;
    const display = LEVEL_DISPLAY[level];

    return (
        <section
            aria-labelledby="regulator-panel-heading"
            className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4"
        >
            <div className="flex items-center justify-between gap-2">
                <Heading level={3} id="regulator-panel-heading" className="text-foreground">
                    OH ステータス
                </Heading>
                <span
                    role={level === 'expired' ? 'status' : undefined}
                    className={`rounded-md px-2 py-0.5 text-xs ${display.className}`}
                >
                    <span aria-hidden="true">{display.symbol} </span>
                    {display.label}
                </span>
            </div>

            <p className="font-semibold text-foreground text-lg">
                <span className="sr-only">機材名: </span>
                {`${status.brand} ${status.model}`}
            </p>
            <p className="text-muted-foreground">{`次回 OH 期限: ${formatJstDate(nextOverhaulDate)}`}</p>
            <p className="text-muted-foreground">
                {`${formatRemainingDays(remainingDays)} / ${formatRemainingDives(remainingDives)}`}
            </p>

            <div className="flex items-center justify-between gap-2 pt-2">
                {recordButton}
                <Link href="/settings/equipment" className="text-primary underline underline-offset-4">
                    機材を管理
                </Link>
            </div>
        </section>
    );
};
