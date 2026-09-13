import type { RecentDiveItem } from '@/features/dashboard';
import { RecentDives } from '@/features/dashboard';
import { GuideView, PAGE_DATA } from '@/features/guide';
import { BarChart } from '@/shared/components/chart/BarChart';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { generatePageMetadata } from '@/shared/config/metadata';

/** 公開ページのため noIndex を付けない（FR-010） */
export const metadata = generatePageMetadata(PAGE_DATA);

/** 例示表示用のサンプルログ（実データではない。リンク先が存在しないため inert で操作対象から外す） */
const SAMPLE_DIVES: RecentDiveItem[] = [
    {
        id: 'sample-1',
        diveDate: '2026-05-10',
        location: '石垣島 / マンタスクランブル',
        maxDepthM: 18.5,
        bottomTimeMin: 42,
        coverThumbUrl: null,
    },
    {
        id: 'sample-2',
        diveDate: '2026-04-29',
        location: '伊豆 / 大瀬崎',
        maxDepthM: 24.0,
        bottomTimeMin: 38,
        coverThumbUrl: null,
    },
    {
        id: 'sample-3',
        diveDate: '2026-04-12',
        location: '沖縄 / 青の洞窟',
        maxDepthM: 12.0,
        bottomTimeMin: 45,
        coverThumbUrl: null,
    },
];

/** 例示表示用のサンプル統計（年別ダイブ本数） */
const SAMPLE_YEARLY_COUNTS = [
    { label: '2023', value: 12 },
    { label: '2024', value: 18 },
    { label: '2025', value: 24 },
    { label: '2026', value: 9 },
];

/** 例示表示の枠。サンプルであることを明示し、本文はテキストのみで完結する（FR-009） */
const ExampleFrame = ({ children }: { children: React.ReactNode }) => (
    <figure className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4">
        <figcaption className="text-muted-foreground text-xs">表示イメージ（サンプル）</figcaption>
        {children}
    </figure>
);

/**
 * 使い方ページ（030-usage-guide / FR-001）。未ログインでも閲覧できる公開ページ
 * （proxy.ts のホワイトリスト方式により認証ガードの対象外）。
 * 例示表示は feature 間 import 禁止のため app 層で組み立てて GuideView に注入する。
 * 流用するのは表示専用コンポーネントのみ（research.md Decision 4）。
 * サンプルログはリンク先が存在しないため inert で操作・フォーカス対象から外す。
 */
export default function GuidePage() {
    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: PAGE_DATA.title }]} />
            <GuideView
                examples={{
                    'dive-logs': (
                        <ExampleFrame>
                            <div inert className="select-none">
                                <RecentDives dives={SAMPLE_DIVES} />
                            </div>
                        </ExampleFrame>
                    ),
                    dashboard: (
                        <ExampleFrame>
                            <BarChart
                                items={SAMPLE_YEARLY_COUNTS}
                                description="年別ダイブ本数の表示例。2023 年 12 本、2024 年 18 本、2025 年 24 本、2026 年 9 本"
                            />
                        </ExampleFrame>
                    ),
                }}
            />
        </div>
    );
}
