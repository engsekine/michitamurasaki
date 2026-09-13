'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import {
    CONTACT_BODY_MAX_LENGTH,
    CONTACT_COMPLETE_PATH,
    INQUIRY_CATEGORY_OPTIONS,
    inquiryCategoryLabel,
} from '@/features/contact/constants';
import { type ContactFormValues, contactSchema } from '@/features/contact/schemas/contact.schema';
import { submitInquiry } from '@/features/contact/server/actions';
import { FormField, FormSelect, FormTextarea } from '@/shared/components/form';
import { Button } from '@/shared/components/ui/Button';

interface ContactFormProps {
    /** 初期値（ログイン中は氏名・メールが補完される。未ログインは空 / FR-013） */
    defaultValues: ContactFormValues;
}

type Step = 'input' | 'confirm';

export const ContactForm = ({ defaultValues }: ContactFormProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [step, setStep] = useState<Step>('input');
    const [confirmedValues, setConfirmedValues] = useState<ContactFormValues | null>(null);

    const {
        register,
        handleSubmit,
        setError,
        clearErrors,
        formState: { errors },
    } = useForm<ContactFormValues>({
        resolver: yupResolver(contactSchema),
        defaultValues,
    });

    // 入力 → 確認: バリデーション通過後に確認画面へ進む
    const goToConfirm = handleSubmit((values) => {
        setConfirmedValues(values);
        setStep('confirm');
    });

    // 確認 → 入力: 修正のため入力画面へ戻す
    const handleBackToInput = () => {
        clearErrors('root');
        setStep('input');
    };

    // 確認 → 送信: 成功でサンクスページへ遷移、失敗は確認画面にとどまりエラー表示
    const handleSend = () => {
        if (!confirmedValues) return;
        startTransition(async () => {
            const result = await submitInquiry(confirmedValues);
            if (!result.success) {
                setError('root', { message: result.error });
                return;
            }
            router.push(CONTACT_COMPLETE_PATH);
        });
    };

    if (step === 'confirm' && confirmedValues) {
        const rows: { label: string; value: string }[] = [
            { label: 'お名前', value: confirmedValues.name },
            { label: 'メールアドレス', value: confirmedValues.email },
            { label: 'お問い合わせ種別', value: inquiryCategoryLabel(confirmedValues.category) },
        ];

        return (
            <div className="flex flex-col gap-4">
                <h2 className="font-semibold text-foreground text-lg">入力内容の確認</h2>
                <p className="text-muted-foreground text-sm">入力内容をご確認のうえ、送信してください。</p>

                <dl className="flex flex-col gap-3">
                    {rows.map((row) => (
                        <div key={row.label} className="flex flex-col gap-1">
                            <dt className="font-medium text-muted-foreground text-sm">{row.label}</dt>
                            <dd className="text-foreground text-sm">{row.value}</dd>
                        </div>
                    ))}
                    <div className="flex flex-col gap-1">
                        <dt className="font-medium text-muted-foreground text-sm">お問い合わせ内容</dt>
                        <dd className="whitespace-pre-wrap text-foreground text-sm">{confirmedValues.body}</dd>
                    </div>
                </dl>

                {errors.root && (
                    <p role="alert" className="text-red-600 text-sm">
                        {errors.root.message}
                    </p>
                )}

                <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="outline" onClick={handleBackToInput} disabled={isPending}>
                        入力内容を修正する
                    </Button>
                    <Button type="button" onClick={handleSend} disabled={isPending} aria-busy={isPending}>
                        {isPending ? '送信中...' : '送信する'}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={goToConfirm} className="flex flex-col gap-4" noValidate>
            <FormField
                id="name"
                label="お名前"
                type="text"
                autoComplete="name"
                required
                error={errors.name?.message}
                {...register('name')}
            />

            <FormField
                id="email"
                label="メールアドレス"
                type="email"
                autoComplete="email"
                required
                error={errors.email?.message}
                {...register('email')}
            />

            <FormSelect
                id="category"
                label="お問い合わせ種別"
                options={INQUIRY_CATEGORY_OPTIONS}
                placeholder="選択してください"
                required
                error={errors.category?.message}
                {...register('category')}
            />

            <FormTextarea
                id="body"
                label="お問い合わせ内容"
                rows={8}
                maxLength={CONTACT_BODY_MAX_LENGTH}
                required
                error={errors.body?.message}
                {...register('body')}
            />

            {/* ハニーポット: 視覚・支援技術の双方から隠す。bot が入力すると送信を破棄する（R-003） */}
            <div aria-hidden="true" className="sr-only">
                <label htmlFor="contact-website">Web サイト（入力しないでください）</label>
                <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
            </div>

            <div className="flex justify-end">
                <Button type="submit">確認画面へ進む</Button>
            </div>
        </form>
    );
};
