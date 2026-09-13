import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DeleteDiveButton } from '@/features/dives/components/client/DeleteDiveButton';
import { DivePhotoGallery } from '@/features/dives/components/client/DivePhotoGallery';
import { DivePhotoUploader } from '@/features/dives/components/client/DivePhotoUploader';
import { DiveVisibilityToggle } from '@/features/dives/components/client/DiveVisibilityToggle';
import { TANK_TYPE_LABEL_MAP, type TankTypeValue } from '@/features/dives/constants';
import { diveLocationLabel } from '@/features/dives/lib/diveLabel';
import { calcSacRate, formatSacRate, SAC_INPUT_FIELD_LABELS } from '@/features/dives/lib/sacRate';
import type { Dive, DiveBuddy, DivePhotoView } from '@/features/dives/types';
import { SnsShareButtons } from '@/shared/components/social/SnsShareButtons';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { SITE_NAME, SITE_URL } from '@/shared/constants/site';
import { formatJstDate } from '@/shared/lib/date';
import { profilePath } from '@/shared/lib/profile-path';
import { getTidePhase, TIDE_PHASE_LABELS } from '@/shared/lib/tide';

interface DiveDetailProps {
    dive: Dive;
    /** 添付写真（表示順・署名 URL 解決済み）。既定は空 */
    photos?: DivePhotoView[];
    /** 同行バディ（登録ユーザー + フリーテキスト）。既定は空 */
    buddies?: DiveBuddy[];
    /** 本人として写真を管理（追加）できるか。公開ページなどでは false */
    canManage?: boolean;
    /**
     * いいね操作/件数表示のスロット（spec 027）。app 層が LikeButton 等を注入する。
     * dives → social の cross-feature import を避けるため ReactNode で受ける
     */
    likeAction?: ReactNode;
}

/** 同行バディ一覧。登録ユーザーはプロフィールへリンク、フリーテキストは素テキスト（spec 021 FR-004） */
const BuddyList = ({ buddies }: { buddies: DiveBuddy[] }) => {
    if (buddies.length === 0) return <span className="text-sm">{EMPTY_PLACEHOLDER}</span>;
    return (
        <ul className="flex flex-wrap gap-2">
            {buddies.map((buddy) =>
                buddy.isRegistered && buddy.userId ? (
                    <li key={buddy.id}>
                        <Link
                            // リンクはユーザー ID（034）。未解決時は内部 ID URL → ページ側転送で正規化される
                            href={profilePath({ userId: buddy.userId, handle: buddy.handle }) as Route}
                            className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                            {buddy.name}
                        </Link>
                    </li>
                ) : (
                    <li key={buddy.id} className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm">
                        {buddy.name}
                    </li>
                ),
            )}
        </ul>
    );
};

const EMPTY_PLACEHOLDER = '—';

const formatTime = (value: string | null): string | null => {
    if (!value) return null;
    return value.slice(0, 5);
};

const formatTankType = (value: TankTypeValue | null): string | null => {
    if (!value) return null;
    return TANK_TYPE_LABEL_MAP[value];
};

const Field = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
    const displayValue = value === null || value === undefined || value === '' ? EMPTY_PLACEHOLDER : value;
    return (
        <dl className="flex flex-col gap-1">
            <dt className="font-medium text-sm">{label}</dt>
            <dd className="rounded-md border border-border bg-background px-3 py-2 text-sm">{displayValue}</dd>
        </dl>
    );
};

const FullField = ({ label, value }: { label: string; value: string | null | undefined }) => {
    const displayValue = value === null || value === undefined || value === '' ? EMPTY_PLACEHOLDER : value;
    return (
        <dl className="flex flex-col gap-1">
            <dt className="font-medium text-sm">{label}</dt>
            <dd className="whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-2 text-sm">
                {displayValue}
            </dd>
        </dl>
    );
};

export const DiveDetail = ({ dive, photos = [], buddies = [], canManage = false, likeAction }: DiveDetailProps) => {
    const tidePhase = getTidePhase(dive.diveDate);
    const sacRate = calcSacRate(dive);

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">{formatJstDate(dive.diveDate)}</span>
                        {/* バッジは text-muted-foreground だと bg-muted 上でコントラスト AA 未達のため text-foreground を使う */}
                        {tidePhase !== null && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-foreground text-xs">
                                <span className="sr-only">潮回り: </span>
                                {TIDE_PHASE_LABELS[tidePhase]}
                            </span>
                        )}
                    </div>
                    {likeAction}
                </div>
                <Heading level={1} className="items-baseline gap-2">
                    {dive.diveSite ? (
                        <Link href={`/dive-sites/${dive.diveSite.id}` as Route} className="text-primary underline">
                            {diveLocationLabel(dive)}
                        </Link>
                    ) : (
                        diveLocationLabel(dive)
                    )}
                    {dive.diveNumber !== null && (
                        <span className="font-normal text-muted-foreground text-xl">#{dive.diveNumber}</span>
                    )}
                </Heading>
                {dive.certificationDive && (
                    <span className="inline-block w-fit rounded-md bg-primary/10 px-2 py-0.5 text-primary text-xs">
                        講習ダイブ
                    </span>
                )}
            </header>

            {canManage && (
                <section aria-labelledby="dive-detail-visibility" className="flex flex-col gap-2">
                    <h2 id="dive-detail-visibility" className="font-medium text-sm">
                        公開設定
                    </h2>
                    <DiveVisibilityToggle diveId={dive.id} initialIsPublic={dive.isPublic} />
                </section>
            )}

            {/* SNS 共有は公開ログのみ・閲覧者にも表示する（spec 035 FR-001。canManage に依存させない） */}
            {dive.isPublic && (
                <section aria-labelledby="dive-detail-share" className="flex flex-col gap-2">
                    <h2 id="dive-detail-share" className="font-medium text-sm">
                        SNSで共有
                    </h2>
                    <SnsShareButtons
                        url={`${SITE_URL}/dives/${dive.id}`}
                        text={`${diveLocationLabel(dive)}のダイビングログ（${formatJstDate(dive.diveDate)}）| ${SITE_NAME}`}
                    />
                </section>
            )}

            <section aria-labelledby="dive-detail-basic" className="flex flex-col gap-4">
                <h2 id="dive-detail-basic" className="font-semibold text-lg">
                    基本情報
                </h2>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Field label="エントリー時刻" value={formatTime(dive.entryTime)} />
                    <Field label="エキジット時刻" value={formatTime(dive.exitTime)} />
                    <Field
                        label="開始残圧(bar)"
                        value={dive.pressureStartBar === null ? null : `${dive.pressureStartBar}`}
                    />
                    <Field
                        label="終了残圧(bar)"
                        value={dive.pressureEndBar === null ? null : `${dive.pressureEndBar}`}
                    />
                </div>

                <Field label="ダイブタイプ" value={dive.diveType} />

                {/* 紐付けたショップ（033 / FR-008）。RLS により本人以外では shop が null になるため公開ビューには出ない */}
                {dive.shop && (
                    <dl className="flex flex-col gap-1">
                        <dt className="font-medium text-sm">ショップ</dt>
                        <dd>
                            <Link href={`/shops/${dive.shop.id}` as Route} className="text-primary underline">
                                {dive.shop.name}
                            </Link>
                        </dd>
                    </dl>
                )}
            </section>

            <section aria-labelledby="dive-detail-numbers" className="flex flex-col gap-4">
                <h2 id="dive-detail-numbers" className="font-semibold text-lg">
                    水深・時間
                </h2>

                <div className="grid grid-cols-3 gap-3">
                    <Field label="最大水深(m)" value={dive.maxDepthM} />
                    <Field label="平均水深(m)" value={dive.avgDepthM} />
                    <Field label="潜水時間(分)" value={dive.bottomTimeMin} />
                </div>
            </section>

            <section aria-labelledby="dive-detail-condition" className="flex flex-col gap-4">
                <h2 id="dive-detail-condition" className="font-semibold text-lg">
                    コンディション
                </h2>

                <div className="grid grid-cols-3 gap-3">
                    <Field label="気温(℃)" value={dive.airTempC} />
                    <Field label="水温(℃)" value={dive.waterTempC} />
                    <Field label="透明度(m)" value={dive.visibilityM} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="天気" value={dive.weather} />
                    <Field label="波・うねり" value={dive.wave} />
                    <Field label="流れ" value={dive.currentCondition} />
                </div>
            </section>

            <section aria-labelledby="dive-detail-equipment" className="flex flex-col gap-4">
                <h2 id="dive-detail-equipment" className="font-semibold text-lg">
                    タンク・装備
                </h2>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Field label="タンク種別" value={formatTankType(dive.tankType)} />
                    <Field label="タンク容量(L)" value={dive.tankVolumeL} />
                    <Field label="ガス種類" value={dive.gasType} />
                    <Field label="酸素濃度(%)" value={dive.o2Percent} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="ウェイト(kg)" value={dive.weightKg} />
                    <Field label="スーツ" value={dive.suitType} />
                </div>

                {sacRate.status === 'ok' && <Field label="エア消費率" value={formatSacRate(sacRate.sacRateLpm)} />}
                {sacRate.status === 'missing' && (
                    <p className="text-muted-foreground text-sm">
                        {sacRate.missingFields.map((field) => SAC_INPUT_FIELD_LABELS[field]).join('・')}
                        を入力するとエア消費率が表示されます
                    </p>
                )}

                <FullField label="装備メモ" value={dive.equipmentNotes} />
            </section>

            <section aria-labelledby="dive-detail-others" className="flex flex-col gap-4">
                <h2 id="dive-detail-others" className="font-semibold text-lg">
                    バディ・メモ
                </h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="バディ名（旧）" value={dive.buddyName} />
                    <Field label="インストラクター名" value={dive.instructorName} />
                </div>

                <dl className="flex flex-col gap-1">
                    <dt className="font-medium text-sm">同行バディ</dt>
                    <dd>
                        <BuddyList buddies={buddies} />
                    </dd>
                </dl>

                <FullField label="メモ・印象" value={dive.notes} />
            </section>

            {(photos.length > 0 || canManage) && (
                <section aria-labelledby="dive-detail-photos" className="flex flex-col gap-4">
                    <h2 id="dive-detail-photos" className="font-semibold text-lg">
                        写真
                    </h2>
                    <DivePhotoGallery photos={photos} canManage={canManage} />
                    {canManage && (
                        <DivePhotoUploader diveId={dive.id} userId={dive.userId} existingCount={photos.length} />
                    )}
                </section>
            )}

            {/* PDF出力・編集・削除は作成者のみ。他人の公開ログでは操作させない（閲覧専用） */}
            {canManage && (
                <div className="flex items-center justify-end gap-2 border-border border-t pt-6">
                    <a
                        href={`/dives/export?format=pdf&ids=${dive.id}`}
                        download
                        className={buttonVariants({ variant: 'outline' })}
                    >
                        PDF出力
                    </a>
                    <Link href={`/dives/${dive.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
                        編集
                    </Link>
                    <DeleteDiveButton diveId={dive.id} />
                </div>
            )}
        </div>
    );
};
