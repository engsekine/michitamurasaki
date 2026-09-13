import Link from 'next/link';
import type { NextPlanSummary } from '@/features/plans/types';
import { cn } from '@/lib/utils';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { formatJstDateWithWeekday } from '@/shared/lib/date';
import { getTidePhase, TIDE_PHASE_LABELS } from '@/shared/lib/tide';

import { ForgottenItemChecklist } from '../../client/ForgottenItemChecklist';
import { PackingChecklist } from '../../client/PackingChecklist';

interface NextPlanCardViewProps {
    summary: NextPlanSummary | null;
    /**
     * hero: TOP の FV（写真背景 + スクリム）上に置くすりガラス配色（DashboardHero の他要素と統一）。
     * default: 通常背景（本文セクション・/plans）用のテーマ配色
     */
    variant?: 'default' | 'hero';
}

/** 残り日数の表示。色だけに依存せずテキストで伝える（表記は PlanList と統一: あと N 日） */
const formatDaysUntil = (daysUntil: number): string => {
    if (daysUntil === 0) return '今日';
    return `あと ${daysUntil} 日`;
};

export const NextPlanCardView = ({ summary, variant = 'default' }: NextPlanCardViewProps) => {
    const isHero = variant === 'hero';

    if (!summary) {
        return (
            <section
                aria-labelledby="next-plan-empty-heading"
                className="flex flex-col items-start gap-3 rounded-lg border border-border bg-background p-4"
            >
                {/* app/page.tsx の h2「次のダイビング予定」配下に置かれるため h3 が正しい階層 */}
                <Heading level={3} id="next-plan-empty-heading" className="text-foreground">
                    次の予定
                </Heading>
                <p className="text-muted-foreground">次のダイビングを計画しよう</p>
                <Link href="/plans/new" className={buttonVariants()}>
                    予定を作成する
                </Link>
            </section>
        );
    }

    const tidePhase = getTidePhase(summary.plannedOn);
    const totalCount = summary.packingItems.length;
    const checkedCount = summary.packingItems.filter((item) => item.isChecked).length;
    const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
    // 複数カードを並べても id が重複しないよう予定 id で修飾する
    const headingId = `next-plan-heading-${summary.id}`;

    return (
        <section
            aria-labelledby={headingId}
            className={cn(
                'overflow-hidden rounded-xl border',
                isHero ? 'border-white/15 bg-white/10 backdrop-blur-sm' : 'border-border bg-background',
            )}
        >
            <div className="grid sm:grid-cols-[1fr_280px]">
                {/* 左ペイン: 予定の概要 */}
                <div className="flex flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1">
                            <p
                                className={cn(
                                    'flex items-center gap-2',
                                    isHero ? 'text-white/70' : 'text-muted-foreground',
                                )}
                            >
                                <span>
                                    <span className="sr-only">予定日: </span>
                                    {formatJstDateWithWeekday(summary.plannedOn)}
                                </span>
                                {/* バッジは text-muted-foreground だと bg-muted 上でコントラスト AA 未達のため text-foreground を使う */}
                                {tidePhase !== null && (
                                    <span
                                        className={cn(
                                            'rounded-md px-2 py-0.5 text-xs',
                                            isHero ? 'bg-white/15 text-white' : 'bg-muted text-foreground',
                                        )}
                                    >
                                        <span className="sr-only">潮回り: </span>
                                        {TIDE_PHASE_LABELS[tidePhase]}
                                    </span>
                                )}
                            </p>
                            <Heading
                                level={3}
                                id={headingId}
                                className={cn('text-2xl', isHero ? 'text-white' : 'text-foreground')}
                            >
                                {summary.location}
                            </Heading>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#1a73cc] px-3 py-1 font-semibold text-sm text-white">
                            <span className="sr-only">残り日数: </span>
                            {formatDaysUntil(summary.daysUntil)}
                        </span>
                    </div>
                    {summary.notes && (
                        <p className={cn('whitespace-pre-wrap', isHero ? 'text-white/70' : 'text-muted-foreground')}>
                            {summary.notes}
                        </p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                        <Link
                            href={`/plans/${summary.id}`}
                            className={
                                isHero
                                    ? 'inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 font-bold text-[oklch(0.28_0.08_255)] text-sm transition-colors hover:bg-white/90'
                                    : buttonVariants({ variant: 'default' })
                            }
                        >
                            予定の詳細
                        </Link>
                        <Link
                            href={`/plans/${summary.id}`}
                            className={
                                isHero
                                    ? 'inline-flex h-9 items-center justify-center rounded-lg border border-white/40 px-4 font-bold text-sm text-white transition-colors hover:bg-white/10'
                                    : buttonVariants({ variant: 'outline' })
                            }
                        >
                            持ち物を準備する
                        </Link>
                    </div>
                </div>

                {/* 右ペイン: 持ち物の準備状況。完了中は忘れ物確認リストに置き換える（037 / FR-003・Q2） */}
                <div
                    className={cn(
                        'flex flex-col gap-3 border-t p-5 sm:border-t-0 sm:border-l',
                        isHero ? 'border-white/15 bg-white/5' : 'border-border bg-muted/40',
                    )}
                >
                    {summary.packingCompletedAt ? (
                        <>
                            <Heading level={4} className={isHero ? 'text-white' : 'text-foreground'}>
                                忘れ物確認
                            </Heading>
                            <ForgottenItemChecklist
                                planId={summary.id}
                                items={summary.packingItems}
                                variant={variant}
                            />
                        </>
                    ) : (
                        <>
                            <Heading level={4} className={isHero ? 'text-white' : 'text-foreground'}>
                                持ち物の準備
                            </Heading>
                            <p className={cn('font-semibold text-2xl', isHero ? 'text-white' : 'text-foreground')}>
                                {checkedCount}{' '}
                                <span className={cn('font-normal', isHero ? 'text-white/70' : 'text-muted-foreground')}>
                                    / {totalCount} 準備済み
                                </span>
                            </p>
                            <div
                                role="progressbar"
                                aria-valuenow={checkedCount}
                                aria-valuemin={0}
                                aria-valuemax={totalCount}
                                aria-label="持ち物の準備進捗"
                                className={cn(
                                    'h-2 w-full overflow-hidden rounded-full',
                                    isHero ? 'bg-white/20' : 'bg-border',
                                )}
                            >
                                {/* 進捗率は動的値のためインライン style を許容（css.md） */}
                                <div
                                    className={cn('h-full rounded-full', isHero ? 'bg-white' : 'bg-primary')}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <PackingChecklist
                                items={summary.packingItems}
                                variant={variant}
                                planId={summary.id}
                                canComplete
                            />
                        </>
                    )}
                </div>
            </div>
        </section>
    );
};
