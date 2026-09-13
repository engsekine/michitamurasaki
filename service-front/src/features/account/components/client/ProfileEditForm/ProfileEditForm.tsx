'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { type ProfileFormValues, profileSchema } from '@/features/account/schemas/profile.schema';
import { updateProfile } from '@/features/account/server/actions';
import { EmailOptInField, FormField, FormRadioGroup } from '@/shared/components/form';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { DIVER_TYPE_OPTIONS } from '@/shared/constants/diver-type';
import { GENDER_OPTIONS } from '@/shared/constants/gender';

interface ProfileEditFormProps {
    email: string;
    defaultValues: ProfileFormValues;
}

export const ProfileEditForm = ({ email, defaultValues }: ProfileEditFormProps) => {
    const [isPending, startTransition] = useTransition();
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors, isDirty },
    } = useForm<ProfileFormValues>({
        resolver: yupResolver(profileSchema),
        defaultValues,
    });

    const isInstructor = watch('diverType') === 'instructor';

    const onSubmit = handleSubmit((values) => {
        setSuccessMessage(null);
        startTransition(async () => {
            const result = await updateProfile({
                ...values,
                diverType: values.diverType ?? null,
                diverNumber: values.diverNumber ?? null,
            });
            if (!result.success) {
                setError('root', { message: result.error });
                return;
            }
            setSuccessMessage('プロフィールを更新しました');
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
            {/* メールアドレスは変更不可の読み取り専用表示 + 補足文があるため FormField を使わない */}
            <div className="flex flex-col gap-1">
                <label htmlFor="email" className="font-medium text-sm">
                    メールアドレス
                </label>
                <Input id="email" type="email" value={email} readOnly disabled aria-readonly="true" />
                <span className="text-muted-foreground text-xs">メールアドレスは変更できません</span>
            </div>

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
                    label="身長（cm）"
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
                    label="体重（kg）"
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

            <EmailOptInField id="emailOptIn" error={errors.emailOptIn?.message} {...register('emailOptIn')} />

            {errors.root && (
                <div role="alert" className="text-red-600 text-sm">
                    {errors.root.message}
                </div>
            )}

            {successMessage && (
                <div role="status" aria-live="polite" className="text-green-600 text-sm">
                    {successMessage}
                </div>
            )}

            <Button type="submit" disabled={isPending || !isDirty} aria-busy={isPending}>
                {isPending ? '更新中...' : '更新する'}
            </Button>
        </form>
    );
};
