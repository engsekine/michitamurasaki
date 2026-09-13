'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AGENCIES, AGENCY_LABELS } from '@/features/certifications/constants';
import {
    type CertificationFormValues,
    certificationSchema,
} from '@/features/certifications/schemas/certification.schema';
import { createCertification, updateCertification } from '@/features/certifications/server/actions';
import { FormField, FormSelect, type FormSelectOption } from '@/shared/components/form';
import { Button, buttonVariants } from '@/shared/components/ui/Button';

interface CertificationFormProps {
    /** 編集対象の資格 ID（未指定なら新規登録モード） */
    certificationId?: string;
    defaultValues?: Partial<CertificationFormValues>;
    /** 取得ダイブの選択肢（feature 間 import を避けるためページ側で dives から組み立てて渡す） */
    diveOptions?: FormSelectOption[];
}

const AGENCY_OPTIONS = AGENCIES.map((agency) => ({ value: agency, label: AGENCY_LABELS[agency] }));

const createDefaultValues = (overrides?: Partial<CertificationFormValues>): Partial<CertificationFormValues> => ({
    rank: '',
    acquiredOn: '',
    diverNumber: '',
    instructorNumber: '',
    trainedBy: '',
    acquiredLocation: '',
    specialtyTags: '',
    diveId: '',
    ...overrides,
});

export const CertificationForm = ({ certificationId, defaultValues, diveOptions = [] }: CertificationFormProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    const isEdit = certificationId !== undefined;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CertificationFormValues>({
        resolver: yupResolver(certificationSchema),
        defaultValues: createDefaultValues(defaultValues),
    });

    const onSubmit = handleSubmit((values) => {
        setServerError(null);
        startTransition(async () => {
            const result = isEdit
                ? await updateCertification(certificationId, values)
                : await createCertification(values);
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            router.push('/settings/certifications');
            router.refresh();
        });
    });

    return (
        <form
            onSubmit={(e) => {
                void onSubmit(e);
            }}
            className="flex flex-col gap-4"
            noValidate
        >
            {serverError && (
                <div role="alert" className="text-red-600 text-sm">
                    {serverError}
                </div>
            )}

            <FormSelect
                id="agency"
                label="指導団体"
                required
                options={AGENCY_OPTIONS}
                placeholder="選択してください"
                error={errors.agency?.message}
                {...register('agency')}
            />

            <FormField
                id="rank"
                label="資格ランク"
                required
                error={errors.rank?.message}
                type="text"
                placeholder="例: Open Water Diver"
                autoComplete="off"
                {...register('rank')}
            />

            <FormField
                id="acquiredOn"
                label="取得日"
                required
                error={errors.acquiredOn?.message}
                type="date"
                autoComplete="off"
                {...register('acquiredOn')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    id="diverNumber"
                    label="ダイバーナンバー"
                    error={errors.diverNumber?.message}
                    type="text"
                    placeholder="例: 1234567890"
                    autoComplete="off"
                    {...register('diverNumber')}
                />

                <FormField
                    id="instructorNumber"
                    label="インストラクターナンバー"
                    error={errors.instructorNumber?.message}
                    type="text"
                    placeholder="例: 123456"
                    autoComplete="off"
                    {...register('instructorNumber')}
                />
            </div>

            <FormField
                id="trainedBy"
                label="指導者・ショップ名"
                error={errors.trainedBy?.message}
                type="text"
                placeholder="例: 石垣島ダイビングショップ"
                autoComplete="off"
                {...register('trainedBy')}
            />

            <FormField
                id="acquiredLocation"
                label="取得場所"
                error={errors.acquiredLocation?.message}
                type="text"
                placeholder="例: 沖縄県石垣市"
                autoComplete="off"
                {...register('acquiredLocation')}
            />

            <FormSelect
                id="diveId"
                label="取得ダイブ"
                options={diveOptions}
                placeholder="紐づけない"
                error={errors.diveId?.message}
                {...register('diveId')}
            />

            <FormField
                id="specialtyTags"
                label="スペシャリティタグ"
                error={errors.specialtyTags?.message}
                type="text"
                placeholder="例: エンリッチド・エア, ディープ（カンマ区切りで複数入力）"
                autoComplete="off"
                {...register('specialtyTags')}
            />

            <div className="flex items-center justify-end gap-2">
                <Link href="/settings/certifications" className={buttonVariants({ variant: 'outline' })}>
                    キャンセル
                </Link>
                <Button type="submit" disabled={isPending} aria-busy={isPending}>
                    {isPending ? '保存中...' : isEdit ? '更新する' : '登録する'}
                </Button>
            </div>
        </form>
    );
};
