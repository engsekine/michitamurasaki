import Link from 'next/link';
import type { MonthlyDiveStat, YearlyDiveCount } from '@/features/dashboard/types';
import { BarChart } from '@/shared/components/chart/BarChart';
import { buttonVariants } from '@/shared/components/ui/Button';

import { TrendChartCard } from '../TrendChartCard';

interface DiveTrendsProps {
    /** 年別本数（0 埋め済み）。null は集計失敗、[] はログ 0 件を表す */
    yearlyCounts: YearlyDiveCount[] | null;
    /** 直近 12 ヶ月の月別統計（0 埋め済み・常に 12 要素）。null は集計失敗 */
    monthlyStats: MonthlyDiveStat[] | null;
}

/** 'YYYY-MM' → 「M月」（直近 12 ヶ月内で月名は重複しない） */
const toMonthLabel = (month: string): string => `${Number(month.slice(5))}月`;

/**
 * TOP「累計ダイビング本数」セクションの本体（年別 / 月別のダイビング本数）。
 * 空状態の判定は年別集計（全期間対象）が空かどうかで行う（research.md R-006）。
 * ログはあるが直近 12 ヶ月が 0 本のユーザーには 0 本の推移をそのまま表示する（FR-003）。
 */
export const DiveTrends = ({ yearlyCounts, monthlyStats }: DiveTrendsProps) => {
    if (yearlyCounts === null || monthlyStats === null) {
        return (
            <p role="status" className="text-muted-foreground">
                集計に失敗しました。時間をおいて再度お試しください。
            </p>
        );
    }

    if (yearlyCounts.length === 0) {
        return (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-background p-4">
                <p className="text-muted-foreground">ログを記録すると統計が表示されます。</p>
                <Link href="/dives/new" className={buttonVariants({ variant: 'outline' })}>
                    新しいログを記録
                </Link>
            </div>
        );
    }

    const yearlySummary = yearlyCounts.map(({ year, diveCount }) => `${year}年 ${diveCount}本`).join('、');
    const monthlySummary = monthlyStats
        .map(({ month, diveCount }) => `${toMonthLabel(month)} ${diveCount}本`)
        .join('、');

    return (
        <div className="grid gap-4">
            <TrendChartCard
                title="年別ダイビング本数"
                table={{
                    keyHeader: '年',
                    valueHeader: '本数',
                    rows: yearlyCounts.map(({ year, diveCount }) => ({
                        key: `${year}`,
                        value: `${diveCount} 本`,
                    })),
                }}
            >
                <BarChart
                    items={yearlyCounts.map(({ year, diveCount }) => ({ label: `${year}`, value: diveCount }))}
                    description={`年別ダイビング本数。${yearlySummary}`}
                />
            </TrendChartCard>

            <TrendChartCard
                title="月別ダイビング本数（直近 12 ヶ月）"
                table={{
                    keyHeader: '月',
                    valueHeader: '本数',
                    rows: monthlyStats.map(({ month, diveCount }) => ({
                        key: month,
                        value: `${diveCount} 本`,
                    })),
                }}
            >
                <BarChart
                    items={monthlyStats.map(({ month, diveCount }) => ({
                        label: toMonthLabel(month),
                        value: diveCount,
                    }))}
                    description={`月別ダイビング本数（直近 12 ヶ月）。${monthlySummary}`}
                />
            </TrendChartCard>
        </div>
    );
};
