'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { type ShopFormValues, shopSchema } from '@/features/shops/schemas/shop.schema';
import { createShop, geocodeAddress, updateShop } from '@/features/shops/server/actions';
import type { GeocodeResult } from '@/features/shops/types';
import { FormField, FormTextarea } from '@/shared/components/form';
import { Button, buttonVariants } from '@/shared/components/ui/Button';

import { ShopMap } from '../../server/ShopMap';

interface ShopFormProps {
    /** 編集対象のショップ ID（未指定なら新規登録モード） */
    shopId?: string;
    defaultValues?: Partial<ShopFormValues>;
    /** 編集モードで保存済みの座標があれば初期プレビューに使う（FR-012 と同じ表示から始める） */
    initialCoordinates?: GeocodeResult;
}

const createDefaultValues = (overrides?: Partial<ShopFormValues>): ShopFormValues => ({
    name: '',
    address: '',
    phone: '',
    websiteUrl: '',
    memo: '',
    ...overrides,
});

export const ShopForm = ({ shopId, defaultValues, initialCoordinates }: ShopFormProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    // 住所確定時の地図プレビュー（033 / FR-011）。null = 住所未確定（プレビュー非表示）
    const [preview, setPreview] = useState<GeocodeResult | null>(
        defaultValues?.address && initialCoordinates ? initialCoordinates : null,
    );
    // 同じ住所での再ジオコーディングを防ぐ（blur のたびに外部 API を呼ばない）
    const lastGeocodedAddress = useRef<string | null>(defaultValues?.address ?? null);

    const isEdit = shopId !== undefined;

    const {
        register,
        handleSubmit,
        getValues,
        formState: { errors },
    } = useForm<ShopFormValues>({
        resolver: yupResolver(shopSchema),
        defaultValues: createDefaultValues(defaultValues),
    });

    /** 住所欄の入力確定（フォーカスアウト）で地図プレビューを更新する（FR-011 / FR-013） */
    const handleAddressBlur = () => {
        const address = getValues('address').trim();
        if (address === lastGeocodedAddress.current) return;
        lastGeocodedAddress.current = address;

        if (!address) {
            setPreview(null);
            return;
        }

        void geocodeAddress(address).then((result) => {
            // 失敗（未ログイン等）も「特定できない」表示に落とす。保存は妨げない
            setPreview(result.success ? result : { latitude: null, longitude: null });
        });
    };

    const onSubmit = handleSubmit((values) => {
        setServerError(null);
        startTransition(async () => {
            if (isEdit) {
                const result = await updateShop(shopId, values);
                if (!result.success) {
                    setServerError(result.error);
                    return;
                }
                router.push(`/shops/${shopId}`);
                router.refresh();
                return;
            }

            const result = await createShop(values);
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            router.push(`/shops/${result.id}`);
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

            <FormField
                id="name"
                label="ショップ名"
                required
                error={errors.name?.message}
                type="text"
                placeholder="例: マリンステージ"
                autoComplete="organization"
                {...register('name')}
            />

            <FormField
                id="address"
                label="住所"
                error={errors.address?.message}
                type="text"
                placeholder="例: 静岡県伊東市富戸 837-2"
                autoComplete="street-address"
                {...register('address', { onBlur: handleAddressBlur })}
            />

            {/* 住所確定で自動更新される地図プレビュー（FR-011）。特定不可はメッセージ表示（FR-013） */}
            {preview && <ShopMap latitude={preview.latitude} longitude={preview.longitude} shopName="入力中の住所" />}

            <FormField
                id="phone"
                label="電話番号"
                error={errors.phone?.message}
                type="tel"
                placeholder="例: 0557-51-3535"
                autoComplete="tel"
                {...register('phone')}
            />

            <FormField
                id="websiteUrl"
                label="Web サイト URL"
                error={errors.websiteUrl?.message}
                type="url"
                placeholder="例: https://example.com"
                autoComplete="url"
                {...register('websiteUrl')}
            />

            <FormTextarea id="memo" label="メモ" rows={4} error={errors.memo?.message} {...register('memo')} />

            <div className="flex items-center justify-end gap-2">
                <Link href={isEdit ? `/shops/${shopId}` : '/shops'} className={buttonVariants({ variant: 'outline' })}>
                    キャンセル
                </Link>
                <Button type="submit" disabled={isPending} aria-busy={isPending}>
                    {isPending ? '保存中...' : isEdit ? '更新する' : '登録する'}
                </Button>
            </div>
        </form>
    );
};
