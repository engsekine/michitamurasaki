import Link from 'next/link';
import type { ReactNode } from 'react';
import { AGENCY_LABELS } from '@/features/certifications/constants';
import { calcHeldPeriod, formatHeldPeriod } from '@/features/certifications/lib/heldPeriod';
import type { Certification } from '@/features/certifications/types';
import { buttonVariants } from '@/shared/components/ui/Button';
import { formatJstDate } from '@/shared/lib/date';

interface CertificationListProps {
    certifications: Certification[];
    /** 保有期間計算の基準日（YYYY-MM-DD、JST）。ページ側で todayInJst() を渡す */
    today: string;
    /** 各行の操作エリア（編集リンク・削除ボタン等）。ページ側で組み立てて渡す */
    renderActions?: (certification: Certification) => ReactNode;
}

interface CertificationCardProps {
    certification: Certification;
    today: string;
    actions?: ReactNode;
}

const CertificationCard = ({ certification, today, actions }: CertificationCardProps) => {
    const heldPeriod = formatHeldPeriod(calcHeldPeriod(certification.acquiredOn, today));

    // 値が登録されている任意項目のみ <dt>/<dd> で表示する
    const detailItems = [
        { label: 'ダイバーNo.', value: certification.diverNumber },
        { label: 'インストラクターNo.', value: certification.instructorNumber },
        { label: '指導者・ショップ', value: certification.trainedBy },
        { label: '取得場所', value: certification.acquiredLocation },
    ].filter((item): item is { label: string; value: string } => item.value !== null && item.value !== '');

    return (
        <article className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-base text-foreground">{certification.rank}</h2>
                <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-primary text-xs">
                    {AGENCY_LABELS[certification.agency]}
                </span>
            </div>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
                <div className="flex items-center gap-1">
                    <dt className="font-medium">取得日</dt>
                    <dd>{formatJstDate(certification.acquiredOn)}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <dt className="font-medium">保有期間</dt>
                    <dd>{heldPeriod}</dd>
                </div>
                {detailItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-1">
                        <dt className="font-medium">{item.label}</dt>
                        <dd>{item.value}</dd>
                    </div>
                ))}
                {certification.dive !== null && (
                    <div className="flex items-center gap-1">
                        <dt className="font-medium">取得ダイブ</dt>
                        <dd>
                            <Link href={`/dives/${certification.dive.id}`} className="text-primary underline">
                                {formatJstDate(certification.dive.diveDate)} {certification.dive.location}
                            </Link>
                        </dd>
                    </div>
                )}
            </dl>
            {certification.tags.length > 0 && (
                <ul aria-label="スペシャリティタグ" className="flex flex-wrap gap-1">
                    {/* bg-muted 上の muted-foreground はコントラスト比 4.5:1 を下回るため文字色は foreground */}
                    {certification.tags.map((tag) => (
                        <li key={tag} className="rounded-full bg-muted px-2 py-0.5 text-foreground text-xs">
                            {tag}
                        </li>
                    ))}
                </ul>
            )}
            {actions !== undefined && <div className="flex items-center justify-end gap-2">{actions}</div>}
        </article>
    );
};

export const CertificationList = ({ certifications, today, renderActions }: CertificationListProps) => {
    // FR-010: 資格未登録時は未登録の案内と登録導線（CTA）を表示する
    if (certifications.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border border-dashed bg-background p-12 text-center">
                <p className="text-muted-foreground">保有資格が登録されていません</p>
                <Link href="/settings/certifications/new" className={buttonVariants({ variant: 'default' })}>
                    資格を登録する
                </Link>
            </div>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {certifications.map((certification) => (
                <li key={certification.id}>
                    <CertificationCard
                        certification={certification}
                        today={today}
                        actions={renderActions?.(certification)}
                    />
                </li>
            ))}
        </ul>
    );
};
