import { siteLabel } from '@/features/dive-sites/lib/siteLabel';
import type { DiveSite, SiteStats } from '@/features/dive-sites/types';
import { Heading } from '@/shared/components/typography/Heading';

interface DiveSiteDetailProps {
    site: DiveSite;
    /** 本人のログから算出した実績（導出値） */
    stats: SiteStats;
}

/**
 * ダイブサイト詳細。サイト情報と、本人のログから算出した実績
 * （潜水本数・平均透明度・よく潜る時期）を表示する。0 件・データ不足の空状態に配慮する。
 */
export const DiveSiteDetail = ({ site, stats }: DiveSiteDetailProps) => {
    const bestSeason =
        stats.bestSeasonMonths.length > 0
            ? stats.bestSeasonMonths.map((month) => `${month}月`).join('・')
            : '傾向を出すにはログが不足しています';

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <Heading level={1}>{siteLabel(site)}</Heading>
                {site.description && <p className="text-muted-foreground text-sm">{site.description}</p>}
            </header>

            <section aria-labelledby="dive-site-stats" className="flex flex-col gap-3">
                <h2 id="dive-site-stats" className="font-semibold text-lg">
                    あなたの実績
                </h2>

                {stats.diveCount === 0 ? (
                    <p className="text-muted-foreground text-sm">まだこのサイトのダイブログがありません</p>
                ) : (
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
                            <dt className="font-medium text-muted-foreground text-sm">潜水本数</dt>
                            <dd className="font-semibold text-foreground text-xl">{`${stats.diveCount}本`}</dd>
                        </div>
                        <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
                            <dt className="font-medium text-muted-foreground text-sm">平均透明度</dt>
                            <dd className="font-semibold text-foreground text-xl">
                                {stats.avgVisibilityM === null ? '—' : `${stats.avgVisibilityM}m`}
                            </dd>
                        </div>
                        <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
                            <dt className="font-medium text-muted-foreground text-sm">よく潜る時期</dt>
                            <dd className="font-semibold text-foreground text-xl">{bestSeason}</dd>
                        </div>
                    </dl>
                )}
            </section>
        </div>
    );
};
