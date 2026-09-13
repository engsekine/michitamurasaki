import Link from 'next/link';
import type { ReactNode } from 'react';

import { DiveTrends } from '@/features/dashboard/components/server/DiveTrends';
import { RecentDives } from '@/features/dashboard/components/server/RecentDives';
import { RegulatorPanel } from '@/features/dashboard/components/server/RegulatorPanel';
import {
    getMonthlyDiveStats,
    getPrimaryRegulatorStatus,
    getYearlyDiveCounts,
} from '@/features/dashboard/server/queries';
import type {
    MonthlyDiveStat,
    PrimaryRegulatorStatus,
    RecentDiveItem,
    YearlyDiveCount,
} from '@/features/dashboard/types';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';

interface TopDashboardProps {
    /** 最近のダイブログ（dives 機能のデータはページ側で変換して渡す） */
    recentDives: RecentDiveItem[];
    /** 「次の予定」セクション（plans 機能のコンポーネントはページ側で組み立てて渡す） */
    nextPlanSection?: ReactNode;
    /** OH 完了記録ボタン（regulators 機能の Server Action はページ側で注入する） */
    renderRecordButton?: (regulatorId: string) => ReactNode;
    /** タイムラインセクション（social 機能のコンポーネントはページ側で組み立てて渡す） */
    timelineSection?: ReactNode;
}

/**
 * TOP ダッシュボードの組み立て（FR-002 / 並び順は design/req.md TOP-2〜6）。
 * ヒーロー（FV）と統計は DashboardHero が担当し、ここは FV 以下のセクション
 * （次の予定 → 最近のログ → タイムライン → OH → 累計ダイビング本数）を組み立てる。
 * 他 feature 由来のデータ・コンポーネントは props / slot で受け取る（feature 間 import 禁止のため）。
 */
export const TopDashboard = async ({
    recentDives,
    nextPlanSection,
    renderRecordButton,
    timelineSection,
}: TopDashboardProps) => {
    // 推移の集計失敗時は DiveTrends 側のエラー表示に委ねる（null で渡す）
    let yearlyCounts: YearlyDiveCount[] | null = null;
    let monthlyStats: MonthlyDiveStat[] | null = null;
    try {
        [yearlyCounts, monthlyStats] = await Promise.all([getYearlyDiveCounts(), getMonthlyDiveStats()]);
    } catch (error) {
        console.error('[TopDashboard] trends error:', error);
        yearlyCounts = null;
        monthlyStats = null;
    }

    // 機材取得失敗時はパネルの代わりにエラー文言 + 設定導線を表示する
    let regulatorStatus: PrimaryRegulatorStatus | null = null;
    let regulatorFailed = false;
    try {
        regulatorStatus = await getPrimaryRegulatorStatus();
    } catch (error) {
        console.error('[TopDashboard] regulator error:', error);
        regulatorFailed = true;
    }

    return (
        // セクション間の余白は各セクション側（pt-20 / mt-20）で取る（full-bleed セクションは背景が伸びないよう margin を使う）
        <div className="flex flex-col">
            {nextPlanSection}

            {/* 背景写真を見せるため max-w コンテナを突き抜けてビューポート全幅にする（FV と同じ full-bleed） */}
            <section
                aria-labelledby="dashboard-recent"
                className="-translate-x-1/2 relative isolate left-1/2 mt-20 w-screen overflow-hidden py-12"
            >
                {/* 背景写真 + 可読性スクリム（ダーク時は濃く沈める） */}
                <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[url('/whale2.jpg')] bg-center bg-cover" />
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/45 dark:bg-black/60" />
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4">
                    <div className="flex items-center justify-between gap-4">
                        <Heading level={2} id="dashboard-recent" className="text-white">
                            最近のダイブログ
                        </Heading>
                        {/* 暗い背景写真の上に置くため FV「予定を作成する」と同じ透明ボタンにする */}
                        <Link
                            href="/dives/new"
                            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-white/40 px-4 font-bold text-sm text-white transition-colors hover:bg-white/10"
                        >
                            ログを作成
                        </Link>
                    </div>
                    <RecentDives dives={recentDives} />
                </div>
            </section>

            {timelineSection}

            <section aria-labelledby="dashboard-regulator" className="flex flex-col gap-8 pt-20">
                <Heading level={2} id="dashboard-regulator">
                    レギュレーター OH 状況
                </Heading>
                {regulatorFailed ? (
                    <div className="rounded-lg border border-border bg-background p-4">
                        <p role="status" className="text-muted-foreground">
                            機材情報の取得に失敗しました。時間をおいて再度お試しください。
                        </p>
                        <Link href="/settings/equipment" className="text-primary underline">
                            機材設定を開く
                        </Link>
                    </div>
                ) : (
                    <RegulatorPanel
                        status={regulatorStatus}
                        recordButton={
                            regulatorStatus && renderRecordButton
                                ? renderRecordButton(regulatorStatus.regulatorId)
                                : undefined
                        }
                    />
                )}
                {/* コンテンツの下に機材登録への導線を中央配置で常設する（「すべてのログを見る」と同テイスト） */}
                <Link
                    href="/settings/equipment"
                    className={`${buttonVariants({ variant: 'default', size: 'lg' })} self-center px-10 shadow-md transition-transform hover:scale-105`}
                >
                    機材を登録
                </Link>
            </section>

            <section aria-labelledby="dashboard-trends" className="flex flex-col gap-8 pt-20">
                <Heading level={2} id="dashboard-trends">
                    累計ダイビング本数
                </Heading>
                <DiveTrends yearlyCounts={yearlyCounts} monthlyStats={monthlyStats} />
            </section>
        </div>
    );
};
