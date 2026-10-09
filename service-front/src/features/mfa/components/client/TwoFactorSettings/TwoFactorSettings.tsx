'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { OTP_LENGTH, OTP_PATTERN } from '@/features/mfa/schemas';
import { disableTotpFactor, enrollTotpFactor, verifyTotpFactor } from '@/features/mfa/server/actions';
import { Button } from '@/shared/components/ui/Button';

interface TwoFactorSettingsProps {
    /** 現在 2 要素認証が有効か（verified な TOTP 要素があるか） */
    initialEnabled: boolean;
    /** 対象の TOTP 要素 ID（無効化に使う）。無効時は null */
    initialFactorId: string | null;
}

interface PendingEnrollment {
    factorId: string;
    qrCode: string;
    secret: string;
}

/**
 * 設定画面の 2 要素認証セクション（023 / US2 / FR-008・FR-009・FR-014）。
 * 有効時: 無効化ボタン。無効時: 設定開始 → QR コードを認証アプリで読み取り → コード確認で有効化。
 */
export const TwoFactorSettings = ({ initialEnabled, initialFactorId }: TwoFactorSettingsProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [pending, setPending] = useState<PendingEnrollment | null>(null);

    if (initialEnabled) {
        const handleDisable = () => {
            if (!initialFactorId) return;
            setError(null);
            startTransition(async () => {
                const result = await disableTotpFactor(initialFactorId);
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
                    2 要素認証は<span className="font-medium">有効</span>
                    です。ログイン時に認証アプリの確認コードが必要です。
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

    const handleStart = () => {
        setError(null);
        startTransition(async () => {
            const result = await enrollTotpFactor();
            if (!result.success) {
                setError(result.error);
                return;
            }
            setPending({ factorId: result.factorId, qrCode: result.qrCode, secret: result.secret });
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
            const result = await verifyTotpFactor(pending.factorId, code);
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
                Google Authenticator や 1Password などの認証アプリを登録すると、ログイン時にアプリの確認コードを求める 2
                要素認証を有効化できます。
            </p>

            {pending === null ? (
                <Button type="button" onClick={handleStart} disabled={isPending} aria-busy={isPending}>
                    {isPending ? '準備中...' : '認証アプリを設定する'}
                </Button>
            ) : (
                <>
                    <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
                        <li className="flex flex-col gap-2">
                            <span>認証アプリで下の QR コードを読み取ってください。</span>
                            {/* QR コードは SVG の data URL。最適化サーバーを経由させずそのまま描画する */}
                            <Image
                                src={pending.qrCode}
                                alt="認証アプリ用 QR コード"
                                width={192}
                                height={192}
                                unoptimized
                                className="rounded-md border border-border bg-white p-2"
                            />
                        </li>
                        <li className="flex flex-col gap-1">
                            <span>読み取れない場合は、このシークレットをアプリに手入力してください。</span>
                            <code className="select-all break-all rounded-md bg-muted px-2 py-1 font-mono text-xs">
                                {pending.secret}
                            </code>
                        </li>
                        <li>アプリに表示された {OTP_LENGTH} 桁のコードを入力して有効化してください。</li>
                    </ol>
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

            {error && (
                <div role="alert" className="text-red-600 text-sm">
                    {error}
                </div>
            )}
        </div>
    );
};
