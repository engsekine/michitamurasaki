import type { ReactNode } from 'react';

import { Heading } from '@/shared/components/typography/Heading';

/** 代替データテーブルの 1 行（key が行見出し） */
interface TrendTableRow {
    key: string;
    value: string;
}

interface TrendChartCardProps {
    /** カードの見出し（h3） */
    title: string;
    /** グラフの代替データテーブル（FR-009） */
    table: {
        keyHeader: string;
        valueHeader: string;
        rows: TrendTableRow[];
    };
    /** チャート本体（BarChart / LineChart など） */
    children: ReactNode;
}

/**
 * 統計の推移グラフ 1 枚分のカード（FR-009）。
 * チャートに加えて native の details で代替データテーブルを提供し、
 * グラフを視認できないユーザー・正確な数値を知りたいユーザーの両方に対応する。
 */
export const TrendChartCard = ({ title, table, children }: TrendChartCardProps) => {
    return (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
            {/* TopDashboard の h2「累計ダイビング本数」配下に置かれるため h3 が正しい階層。
                markuplint のコンポーネント単独解析による見出しスキップ誤検知は .markuplintrc で抑止 */}
            <Heading level={3}>{title}</Heading>
            {children}
            <details>
                <summary className="cursor-pointer text-muted-foreground">データを表で見る</summary>
                <table className="mt-2 w-full border-collapse text-left">
                    <thead>
                        <tr className="border-border border-b">
                            <th scope="col" className="py-1 pr-4 font-medium text-muted-foreground">
                                {table.keyHeader}
                            </th>
                            <th scope="col" className="py-1 font-medium text-muted-foreground">
                                {table.valueHeader}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row) => (
                            <tr key={row.key} className="border-border border-b last:border-b-0">
                                <th scope="row" className="py-1 pr-4 font-normal text-foreground">
                                    {row.key}
                                </th>
                                <td className="py-1 text-foreground">{row.value}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </section>
    );
};
