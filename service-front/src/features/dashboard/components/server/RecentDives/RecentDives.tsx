import Image from 'next/image';
import Link from 'next/link';
import type { RecentDiveItem } from '@/features/dashboard/types';
import { buttonVariants } from '@/shared/components/ui/Button';
import { formatJstDate } from '@/shared/lib/date';
import { getTidePhase, TIDE_PHASE_LABELS } from '@/shared/lib/tide';

/** 写真未登録時に出すダミー画像（ロゴ）。public 直下の静的アセット */
const FALLBACK_IMAGE_SRC = '/logo.png';

interface RecentDivesProps {
    /** 直近のダイブログ。表示は先頭 3 件まで（並び順はページ側で保証する） */
    dives: RecentDiveItem[];
}

const MAX_VISIBLE_DIVES = 3;

export const RecentDives = ({ dives }: RecentDivesProps) => {
    if (dives.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border border-dashed bg-background p-8 text-center">
                <p className="text-muted-foreground">ログがまだありません</p>
                <Link href="/dives/new" className={buttonVariants({ variant: 'default' })}>
                    最初のログを記録しよう
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {dives.slice(0, MAX_VISIBLE_DIVES).map((dive) => {
                    const tidePhase = getTidePhase(dive.diveDate);

                    return (
                        <li key={dive.id}>
                            <Link
                                href={`/dives/${dive.id}`}
                                className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background transition-colors hover:bg-muted/50"
                            >
                                {dive.coverThumbUrl ? (
                                    <Image
                                        src={dive.coverThumbUrl}
                                        alt=""
                                        width={400}
                                        height={225}
                                        unoptimized
                                        className="aspect-video w-full object-cover"
                                    />
                                ) : (
                                    // 写真がなければロゴをダミー表示（歪ませないよう contain + 余白）
                                    <div className="flex aspect-video w-full items-center justify-center bg-muted">
                                        <Image
                                            src={FALLBACK_IMAGE_SRC}
                                            alt=""
                                            width={80}
                                            height={40}
                                            className="h-10 w-auto opacity-60"
                                        />
                                    </div>
                                )}
                                <div className="flex flex-1 flex-col gap-1 p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">
                                            <span className="sr-only">潜水日: </span>
                                            {formatJstDate(dive.diveDate)}
                                        </span>
                                        {/* バッジは text-muted-foreground だと bg-muted 上でコントラスト AA 未達のため text-foreground を使う */}
                                        {tidePhase !== null && (
                                            <span className="rounded-md bg-muted px-2 py-0.5 text-foreground text-xs">
                                                <span className="sr-only">潮回り: </span>
                                                {TIDE_PHASE_LABELS[tidePhase]}
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-semibold text-base text-foreground">{dive.location}</span>
                                    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <dt className="font-medium">最大水深</dt>
                                            <dd>{dive.maxDepthM}m</dd>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <dt className="font-medium">潜水時間</dt>
                                            <dd>{dive.bottomTimeMin}分</dd>
                                        </div>
                                    </dl>
                                </div>
                            </Link>
                        </li>
                    );
                })}
            </ul>
            {/* FV「予定を作成する」と同じ透明ボタン（暗い背景写真の上に白ボーダー + 白文字） */}
            <Link
                href="/dives"
                className="inline-flex h-9 items-center justify-center self-center rounded-lg border border-white/40 px-4 font-bold text-sm text-white transition-colors hover:bg-white/10"
            >
                すべてのログを見る
            </Link>
        </div>
    );
};
