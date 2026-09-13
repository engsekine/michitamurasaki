'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { TermsAgreementField } from '@/features/auth/components/client/TermsAgreementField';
import {
    type ProfileCompletionFormValues,
    profileCompletionSchema,
} from '@/features/auth/schemas/profile-completion.schema';
import { completeProfile } from '@/features/auth/server/actions';
import { EmailOptInField, FormField, FormRadioGroup } from '@/shared/components/form';
import { Button } from '@/shared/components/ui/Button';
import { DIVER_TYPE_OPTIONS } from '@/shared/constants/diver-type';
import { DEFAULT_GENDER, GENDER_OPTIONS } from '@/shared/constants/gender';

/**
 * Google ログイン初回ユーザーのプロフィール補完フォーム（016-google-login）。
 * 成功時は completeProfile 内で TOP（`/`）へ redirect されるため、戻り値は失敗時のみ受け取る。
 */
export const ProfileCompletionForm = () => {
    const [isPending, startTransition] = useTransition();

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors },
    } = useForm<ProfileCompletionFormValues>({
        resolver: yupResolver(profileCompletionSchema),
        defaultValues: { gender: DEFAULT_GENDER },
    });

    const isInstructor = watch('diverType') === 'instructor';

    const onSubmit = handleSubmit((values) => {
        startTransition(async () => {
            const result = await completeProfile({
                lastName: values.lastName,
                firstName: values.firstName,
                lastNameRomaji: values.lastNameRomaji,
                firstNameRomaji: values.firstNameRomaji,
                nickname: values.nickname,
                handle: values.handle,
                birthOn: values.birthOn,
                gender: values.gender,
                heightCm: values.heightCm,
                weightKg: values.weightKg,
                agreedToTerms: values.agreedToTerms,
                diverType: values.diverType,
                diverNumber: values.diverNumber ?? null,
                emailOptIn: values.emailOptIn,
            });
            if (!result.success) {
                setError('root', { message: result.error });
            }
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
            <div className="grid grid-cols-2 gap-3">
                <FormField
                    id="lastName"
                    label="姓"
                    type="text"
                    autoComplete="family-name"
                    aria-required="true"
                    error={errors.lastName?.message}
                    {...register('lastName')}
                />

                <FormField
                    id="firstName"
                    label="名"
                    type="text"
                    autoComplete="given-name"
                    aria-required="true"
                    error={errors.firstName?.message}
                    {...register('firstName')}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <FormField
                    id="lastNameRomaji"
                    label="姓（ローマ字）"
                    type="text"
                    autoComplete="off"
                    placeholder="Yamada"
                    aria-required="true"
                    error={errors.lastNameRomaji?.message}
                    {...register('lastNameRomaji')}
                />

                <FormField
                    id="firstNameRomaji"
                    label="名（ローマ字）"
                    type="text"
                    autoComplete="off"
                    placeholder="Taro"
                    aria-required="true"
                    error={errors.firstNameRomaji?.message}
                    {...register('firstNameRomaji')}
                />
            </div>

            <FormField
                id="nickname"
                label="ニックネーム"
                type="text"
                autoComplete="nickname"
                aria-required="true"
                error={errors.nickname?.message}
                {...register('nickname')}
            />

            <FormField
                id="handle"
                label="ユーザー ID"
                type="text"
                autoComplete="off"
                aria-required="true"
                placeholder="例: taro-diver"
                error={errors.handle?.message}
                {...register('handle')}
            />
            <p className="text-muted-foreground text-xs">
                半角英小文字・数字・ハイフン・アンダースコアの 3〜30 文字（先頭は英字）。プロフィールの URL に使われます
            </p>

            <FormField
                id="birthOn"
                label="生年月日"
                type="date"
                autoComplete="bday"
                aria-required="true"
                error={errors.birthOn?.message}
                {...register('birthOn')}
            />

            <FormRadioGroup
                legend="性別"
                options={GENDER_OPTIONS}
                required
                aria-required="true"
                error={errors.gender?.message}
                {...register('gender')}
            />

            <FormRadioGroup
                legend="ダイバー種別"
                options={DIVER_TYPE_OPTIONS}
                required
                aria-required="true"
                error={errors.diverType?.message}
                {...register('diverType')}
            />

            {isInstructor && (
                <FormField
                    id="diverNumber"
                    label="ダイバー番号"
                    type="text"
                    autoComplete="off"
                    error={errors.diverNumber?.message}
                    {...register('diverNumber')}
                />
            )}

            <div className="grid grid-cols-2 gap-3">
                <FormField
                    id="heightCm"
                    label="身長(cm)"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={30}
                    max={300}
                    autoComplete="off"
                    error={errors.heightCm?.message}
                    {...register('heightCm')}
                />

                <FormField
                    id="weightKg"
                    label="体重(kg)"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={1}
                    max={500}
                    autoComplete="off"
                    error={errors.weightKg?.message}
                    {...register('weightKg')}
                />
            </div>

            <TermsAgreementField
                id="agreedToTerms"
                error={errors.agreedToTerms?.message}
                {...register('agreedToTerms')}
            />

            <EmailOptInField id="emailOptIn" error={errors.emailOptIn?.message} {...register('emailOptIn')} />

            {errors.root && (
                <div role="alert" className="text-red-600 text-sm">
                    {errors.root.message}
                </div>
            )}

            <Button type="submit" disabled={isPending} aria-busy={isPending}>
                {isPending ? '保存中...' : '登録して始める'}
            </Button>
        </form>
    );
};
