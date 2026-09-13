'use client';

import Link from 'next/link';

import { diveLocationLabel } from '@/features/dives/lib/diveLabel';
import type { DiveListItem } from '@/features/dives/types';
import { formatJstDate } from '@/shared/lib/date';
import { getTidePhase, TIDE_PHASE_LABELS } from '@/shared/lib/tide';

interface DiveCardProps {
    dive: DiveListItem;
    /** 選択モード時に true。先頭にエクスポート対象選択用のチェックボックスを表示する */
    selectable?: boolean;
    /** 選択中かどうか（selectable 時のみ有効） */
    selected?: boolean;
    /** チェックボックス操作のコールバック */
    onToggleSelect?: (id: string) => void;
}

export const DiveCard = ({ dive, selectable = false, selected = false, onToggleSelect }: DiveCardProps) => {
    const tidePhase = getTidePhase(dive.diveDate);

    const content = (
        <>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">
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
                {dive.diveNumber !== null && (
                    <span className="text-muted-foreground text-xs">
                        <span className="sr-only">ダイブ番号: </span>#{dive.diveNumber}
                    </span>
                )}
            </div>
            <h2 className="font-semibold text-base text-foreground">{diveLocationLabel(dive)}</h2>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
                <div className="flex items-center gap-1">
                    <dt className="font-medium">最大水深</dt>
                    <dd>{dive.maxDepthM}m</dd>
                </div>
                <div className="flex items-center gap-1">
                    <dt className="font-medium">潜水時間</dt>
                    <dd>{dive.bottomTimeMin}分</dd>
                </div>
                {dive.waterTempC !== null && (
                    <div className="flex items-center gap-1">
                        <dt className="font-medium">水温</dt>
                        <dd>{dive.waterTempC}℃</dd>
                    </div>
                )}
                {dive.visibilityM !== null && (
                    <div className="flex items-center gap-1">
                        <dt className="font-medium">透明度</dt>
                        <dd>{dive.visibilityM}m</dd>
                    </div>
                )}
            </dl>
            {dive.certificationDive && (
                <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-primary text-xs">
                    講習ダイブ
                </span>
            )}
        </>
    );

    return (
        <article className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/50">
            {/* 選択（エクスポート）モード中は遷移を無効化し、カード全体をチェックボックスのラベルにする。
                これによりリンクと同じ範囲のクリックで選択トグルでき、誤遷移を防ぐ。 */}
            {selectable ? (
                // label はフロー要素（h2/dl 等）を含められないため div で構成する。
                // キーボード操作は aria-label 付きチェックボックスが担い、
                // コンテンツ部のクリックはマウス向けの選択トグル補助とする。
                <div className="flex flex-1 items-start gap-3">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect?.(dive.id)}
                        aria-label={`エクスポート対象として選択: ${formatJstDate(dive.diveDate)} ${diveLocationLabel(dive)}`}
                        className="mt-1 size-4 shrink-0"
                    />
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: 操作の主体は上のチェックボックス。ここはマウス補助 */}
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: 操作の主体は上のチェックボックス。div は冗長なマウス補助 */}
                    <div
                        className="flex flex-1 cursor-pointer flex-col gap-2"
                        onClick={() => onToggleSelect?.(dive.id)}
                    >
                        {content}
                    </div>
                </div>
            ) : (
                <Link href={`/dives/${dive.id}`} className="flex flex-1 flex-col gap-2">
                    {content}
                </Link>
            )}
        </article>
    );
};
