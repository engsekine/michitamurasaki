import Link from 'next/link';
import type { ReactNode } from 'react';

import { getDashboardHero, getDiveStats, getYearlyDiveCounts } from '@/features/dashboard/server/queries';
import type { DiveStats, HeroNextPlan } from '@/features/dashboard/types';
import { Heading } from '@/shared/components/typography/Heading';
import { SITE_NAME } from '@/shared/constants/site';
import { formatJstDate, formatJstDateWithWeekday, todayInJst } from '@/shared/lib/date';

interface DashboardHeroProps {
    /** ログ作成ボタンの上に置くバッジ（残りログ枠など）。feature 間 import 禁止のためページ側から注入する */
    badge?: ReactNode;
    /** FV に表示する直近の次のダイビング予定。feature 間 import 禁止のためページ側から注入する。予定なしは null */
    nextPlan?: HeroNextPlan | null;
    /**
     * 当日（予定日 = 今日）の予定を表示する詳細カード（持ち物準備付き）。
     * 指定時は見出しを「今日のダイビング予定」に切り替え、nextPlan の簡素カードの代わりに表示する。
     * feature 間 import 禁止のため NextPlanCardView はページ側から注入する
     */
    todayPlanCard?: ReactNode;
}

/** 残り日数の表示（表記は NextPlanCard と統一: 今日 / あと N 日） */
const formatDaysUntil = (daysUntil: number): string => {
    if (daysUntil === 0) return '今日';
    return `あと ${daysUntil} 日`;
};

/**
 * TOP のファーストビュー（design/req.md TOP-1）。
 * 全幅の背景写真（public/whale1.jpg）の上に、挨拶 + 主要統計 4 項目
 * （総ダイブ数 / 今年のダイブ / 最大深度 / ブランク）を 2 カラムのすりガラスパネルで重ね、
 * 直近の次のダイビング予定 1 件と予定作成ボタン（常時表示）を続ける。
 * 写真の上に固定の白文字を置くため、ダークモードでもスクリムの濃さだけを変える。
 */
export const DashboardHero = async ({ badge, nextPlan, todayPlanCard }: DashboardHeroProps) => {
    const hero = await getDashboardHero();

    // 集計失敗時は「—」表示に落とす（FV 全体は出す）
    let stats: DiveStats | null = null;
    let thisYearCount: number | null = null;
    try {
        const currentYear = Number(todayInJst().slice(0, 4));
        const [diveStats, yearlyCounts] = await Promise.all([getDiveStats(), getYearlyDiveCounts()]);
        stats = diveStats;
        thisYearCount = yearlyCounts.find((row) => row.year === currentYear)?.diveCount ?? 0;
    } catch (error) {
        console.error('[DashboardHero] stats error:', error);
    }

    /** 値が取得できない項目は「—」表示（FV 全体は必ず出す） */
    const heroStats = [
        { label: '総ダイブ数', value: stats ? String(stats.totalDives) : '—', unit: '本' },
        { label: '今年のダイブ', value: thisYearCount !== null ? String(thisYearCount) : '—', unit: '本' },
        { label: '最大深度', value: stats ? String(stats.maxDepthM) : '—', unit: 'm' },
        {
            label: 'ブランク',
            value: hero.blankDays !== null ? String(hero.blankDays) : '—',
            unit: '日',
            note: hero.lastDiveOn ? `最終潜水日: ${formatJstDate(hero.lastDiveOn)}` : undefined,
        },
    ];

    return (
        <section aria-labelledby="dashboard-hero" className="relative isolate overflow-hidden">
            {/* 背景写真 + 可読性スクリム（ダーク時は濃く沈める） */}
            <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[url('/whale1.jpg')] bg-center bg-cover" />
            <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,oklch(0.20_0.06_255/0.40)_0%,oklch(0.20_0.06_255/0.15)_45%,oklch(0.16_0.06_255/0.45)_100%)] dark:bg-[linear-gradient(180deg,oklch(0.10_0.04_255/0.60)_0%,oklch(0.10_0.04_255/0.40)_45%,oklch(0.08_0.04_255/0.65)_100%)]"
            />
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-20 px-4 pt-10 pb-12">
                <div className="flex flex-col gap-1">
                    <p className="text-white/70 tracking-wide">{SITE_NAME} — あなたのダイビングのすべてを 1 冊に</p>
                    <Heading level={1} id="dashboard-hero" className="text-white">
                        {hero.nickname ? `ようこそ、${hero.nickname}さん` : 'ようこそ'}
                    </Heading>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                    {heroStats.map((stat) => (
                        <div
                            key={stat.label}
                            className="flex flex-col gap-1 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
                        >
                            <dt className="text-white/70">{stat.label}</dt>
                            <dd className="flex flex-wrap items-baseline justify-between gap-x-2 font-semibold text-2xl text-white">
                                <span>
                                    {stat.value}{' '}
                                    <span className="font-normal text-base text-white/70">{stat.unit}</span>
                                </span>
                                {stat.note && <span className="font-normal text-white/70 text-xs">{stat.note}</span>}
                            </dd>
                        </div>
                    ))}
                </dl>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                        <Heading level={2} className="text-white">
                            {todayPlanCard ? '今日のダイビング予定' : '次のダイビング予定'}
                        </Heading>
                        {/* 当日はカード内の導線（予定の詳細 / 持ち物を準備する）に集中させるため作成ボタンは出さない */}
                        {!todayPlanCard && (
                            <Link
                                href="/plans/new"
                                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-white/40 px-4 font-bold text-sm text-white transition-colors hover:bg-white/10"
                            >
                                予定を作成する
                            </Link>
                        )}
                    </div>
                    {todayPlanCard ? (
                        todayPlanCard
                    ) : nextPlan ? (
                        <Link
                            href={`/plans/${nextPlan.id}`}
                            className="flex items-center justify-between gap-4 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm transition-colors hover:bg-white/15"
                        >
                            <span className="font-semibold text-lg text-white">
                                <span className="sr-only">予定日: </span>
                                {formatJstDateWithWeekday(nextPlan.plannedOn)}
                                <span aria-hidden="true"> — </span>
                                <span className="sr-only">行き先: </span>
                                {nextPlan.location}
                            </span>
                            <span className="shrink-0 rounded-full bg-[#1a73cc] px-3 py-1 font-semibold text-sm text-white">
                                <span className="sr-only">残り日数: </span>
                                {formatDaysUntil(nextPlan.daysUntil)}
                            </span>
                        </Link>
                    ) : (
                        <p className="rounded-xl border border-white/15 bg-white/10 p-4 text-white/70 backdrop-blur-sm">
                            次の予定はまだありません。予定を作成して次のダイビングに備えましょう
                        </p>
                    )}
                </div>
                <div className="flex flex-col items-center gap-3">
                    {badge}
                    <Link
                        href="/dives/new"
                        className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-8 font-bold text-[oklch(0.28_0.08_255)] text-base transition-colors hover:bg-white/90"
                    >
                        ログを作成
                    </Link>
                </div>
            </div>
        </section>
    );
};
