'use client';

import type { ComponentPropsWithRef } from 'react';

import { FormCheckbox } from '../FormCheckbox';

interface EmailOptInFieldProps extends ComponentPropsWithRef<'input'> {
    /** input と label の関連付け */
    id: string;
    error?: string | undefined;
}

/**
 * メール配信許可（022-email-consent）の任意チェックフィールド。
 * 新規登録（SignupForm / ProfileCompletionForm）と設定画面（ProfileEditForm）で共用する横断 UI。
 * 利用規約同意（018）と異なりモーダルは持たず、任意（オプトイン）であることをラベルと
 * 補足文で示す。チェック自体は `emailOptIn` として react-hook-form の `register` をスプレッドする。
 */
export const EmailOptInField = ({ id, error, ...inputProps }: EmailOptInFieldProps) => {
    const descriptionId = `${id}-description`;
    /**
     * FormCheckbox は error 時に `${id}-error` を aria-describedby に設定するが、
     * spread される inputProps が後勝ちで上書きするため、エラーと補足文の両方を結ぶ。
     */
    const describedBy = error ? `${id}-error ${descriptionId}` : descriptionId;

    return (
        <div className="flex flex-col gap-1">
            <FormCheckbox
                id={id}
                label="お知らせメールを受け取る"
                error={error}
                aria-describedby={describedBy}
                {...inputProps}
            />
            <p id={descriptionId} className="text-muted-foreground text-xs">
                点検期限のお知らせなど、サービスからの任意のお知らせメールを受け取ります。登録確認やパスワード再設定など手続き上必要なメールは、この設定に関わらず送信されます。
            </p>
        </div>
    );
};
