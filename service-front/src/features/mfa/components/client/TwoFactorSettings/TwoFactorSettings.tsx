'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { E164_PATTERN, OTP_LENGTH, OTP_PATTERN } from '@/features/mfa/schemas';
import { disablePhoneFactor, enrollPhoneFactor, verifyPhoneFactor } from '@/features/mfa/server/actions';
import { Button } from '@/shared/components/ui/Button';

interface TwoFactorSettingsProps {
    /** 現在 2 要素認証が有効か（verified な phone 要素があるか） */
    initialEnabled: boolean;
    /** 対象の phone 要素 ID（無効化に使う）。無効時は null */
    initialFactorId: string | null;
}

/**
 * 設定画面の 2 要素認証セクション（023 / US2 / FR-008・FR-009・FR-014）。
 * 有効時: 無効化ボタン。無効時: 電話番号入力 → コード送信 → コード確認で有効化。
 */
export const TwoFactorSettings = ({ initialEnabled, initialFactorId }: TwoFactorSettingsProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [pending, setPending] = useState<{ factorId: string; challengeId: string } | null>(null);

    if (initialEnabled) {
        const handleDisable = () => {
            if (!initialFactorId) return;
            setError(null);
            startTransition(async () => {
                const result = await disablePhoneFactor(initialFactorId);
                if (!result.success) {
                    setError(result.error);
                    return;
                }
                router.refresh();
            });
        };

        return (
            <div className="flex flex-col gap-3">
                <p className="text-sm" role="status">
                    2 要素認証は<span className="font-medium">有効</span>です。ログイン時に SMS の確認コードが必要です。
                </p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleDisable}
                    disabled={isPending}
                    aria-busy={isPending}
                >
                    {isPending ? '処理中...' : '2 要素認証を無効化する'}
                </Button>
                {error && (
                    <div role="alert" className="text-red-600 text-sm">
                        {error}
                    </div>
                )}
            </div>
        );
    }

    const handleSendCode = () => {
        setError(null);
        setMessage(null);
        if (!E164_PATTERN.test(phone)) {
            setError('国際形式（例: +819012345678）で入力してください');
            return;
        }
        startTransition(async () => {
            const result = await enrollPhoneFactor(phone);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setPending({ factorId: result.factorId, challengeId: result.challengeId });
            setMessage('確認コードを送信しました。SMS をご確認ください。');
        });
    };

    const handleVerify = () => {
        setError(null);
        if (!pending) return;
        if (!OTP_PATTERN.test(code)) {
            setError(`${OTP_LENGTH} 桁の数字を入力してください`);
            return;
        }
        startTransition(async () => {
            const result = await verifyPhoneFactor(pending.factorId, pending.challengeId, code);
            if (!result.success) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
                電話番号を登録すると、ログイン時に SMS の確認コードを求める 2 要素認証を有効化できます。
            </p>

            {pending === null ? (
                <>
                    <label className="flex flex-col gap-1 text-sm">
                        <span>電話番号（国際形式）</span>
                        <input
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="+819012345678"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="rounded-md border border-border px-3 py-2 text-base"
                        />
                    </label>
                    <Button type="button" onClick={handleSendCode} disabled={isPending} aria-busy={isPending}>
                        {isPending ? '送信中...' : '確認コードを送信する'}
                    </Button>
                </>
            ) : (
                <>
                    <label className="flex flex-col gap-1 text-sm">
                        <span>確認コード（{OTP_LENGTH} 桁）</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="rounded-md border border-border px-3 py-2 text-base"
                        />
                    </label>
                    <Button type="button" onClick={handleVerify} disabled={isPending} aria-busy={isPending}>
                        {isPending ? '確認中...' : '確認して有効化する'}
                    </Button>
                </>
            )}

            <div aria-live="polite" className="text-muted-foreground text-sm">
                {message}
            </div>
            {error && (
                <div role="alert" className="text-red-600 text-sm">
                    {error}
                </div>
            )}
        </div>
    );
};
