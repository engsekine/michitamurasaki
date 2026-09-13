'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { GoogleAuthButton } from '@/features/auth/components/client/GoogleAuthButton';
import { ResendConfirmationButton } from '@/features/auth/components/client/ResendConfirmationButton';
import { TermsAgreementField } from '@/features/auth/components/client/TermsAgreementField';
import { type SignupFormValues, signupSchema } from '@/features/auth/schemas/signup.schema';
import { signUp } from '@/features/auth/server/actions';
import { EmailOptInField, FormField, FormRadioGroup } from '@/shared/components/form';
import { Button } from '@/shared/components/ui/Button';
import { DIVER_TYPE_OPTIONS } from '@/shared/constants/diver-type';
import { DEFAULT_GENDER, GENDER_OPTIONS } from '@/shared/constants/gender';

export const SignupForm = () => {
    const [isPending, startTransition] = useTransition();
    const [sentTo, setSentTo] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors },
    } = useForm<SignupFormValues>({
        resolver: yupResolver(signupSchema),
        defaultValues: { gender: DEFAULT_GENDER },
    });

    const isInstructor = watch('diverType') === 'instructor';

    const onSubmit = handleSubmit((values) => {
        startTransition(async () => {
            const result = await signUp({
                email: values.email,
                password: values.password,
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
                return;
            }
            if (result.needsEmailConfirmation) {
                setSentTo(values.email);
            }
        });
    });

    if (sentTo !== null) {
        return (
            <div className="flex flex-col gap-4" role="status" aria-live="polite">
                <h2 className="font-semibold text-lg">確認メールを送信しました</h2>
                <p className="text-muted-foreground text-sm">
                    <span className="font-medium text-foreground">{sentTo}</span> 宛に確認メールを送信しました。
                    <br />
                    メール内のリンクをクリックして登録を完了してください。
                </p>
                <p className="text-muted-foreground text-sm">
                    メールが届かない場合は、迷惑メールフォルダもご確認のうえ、下のボタンから再送してください。
                </p>
                <ResendConfirmationButton email={sentTo} />
                <Link href="/login" className="text-muted-foreground text-sm underline hover:text-foreground">
                    ログイン画面に戻る
                </Link>
            </div>
        );
    }

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

            <FormField
                id="email"
                label="メールアドレス"
                type="email"
                autoComplete="email"
                aria-required="true"
                error={errors.email?.message}
                {...register('email')}
            />

            <FormField
                id="password"
                label="パスワード（12文字以上・英大文字小文字と数字を含む）"
                type="password"
                autoComplete="new-password"
                aria-required="true"
                error={errors.password?.message}
                {...register('password')}
            />

            <FormField
                id="passwordConfirm"
                label="パスワード（確認）"
                type="password"
                autoComplete="new-password"
                aria-required="true"
                error={errors.passwordConfirm?.message}
                {...register('passwordConfirm')}
            />

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
                {isPending ? '登録中...' : '新規登録'}
            </Button>

            <div className="flex items-center gap-3 text-muted-foreground text-xs">
                <span className="h-px flex-1 bg-border" />
                または
                <span className="h-px flex-1 bg-border" />
            </div>

            <GoogleAuthButton label="Google で続行" />

            <Link href="/login" className="text-muted-foreground text-sm underline hover:text-foreground">
                ログインはこちら
            </Link>
        </form>
    );
};
