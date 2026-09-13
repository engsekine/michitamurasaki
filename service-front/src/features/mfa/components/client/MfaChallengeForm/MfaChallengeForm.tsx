'use client';

import { useState, useTransition } from 'react';
import { OTP_LENGTH, OTP_PATTERN } from '@/features/mfa/schemas';
import { challengeLoginFactor, verifyLogin } from '@/features/mfa/server/actions';
import { Button } from '@/shared/components/ui/Button';
import { useCooldown } from '@/shared/hooks/useCooldown';

/** 再送のクールダウン秒数（FR-013） */
const RESEND_COOLDOWN_SECONDS = 30;

interface MfaChallengeFormProps {
    /** 2 段階目で検証する phone 要素 ID（ページ側で listFactors から解決して渡す） */
    factorId: string;
}

/**
 * ログイン 2 段階目の SMS コード入力フォーム（023 / US2 / FR-010〜013）。
 * まず「送信」で SMS を送り、届いたコードを入力して verifyLogin で AAL2 へ昇格する。
 * 検証成功時はサーバーアクションが TOP（`/`）へ redirect するため、このフォームには戻らない。
 */
export const MfaChallengeForm = ({ factorId }: MfaChallengeFormProps) => {
    const [isPending, startTransition] = useTransition();
    const [challengeId, setChallengeId] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const { cooldown, startCooldown } = useCooldown();

    const handleSendCode = () => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
            const result = await challengeLoginFactor(factorId);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setChallengeId(result.challengeId);
            setMessage('確認コードを送信しました。SMS をご確認ください。');
            startCooldown(RESEND_COOLDOWN_SECONDS);
        });
    };

    const handleVerify = () => {
        setError(null);
        if (challengeId === null) return;
        if (!OTP_PATTERN.test(code)) {
            setError(`${OTP_LENGTH} 桁の数字を入力してください`);
            return;
        }
        startTransition(async () => {
            const result = await verifyLogin(factorId, challengeId, code);
            /** 成功時はサーバー側 redirect のためここには来ない。到達するのは失敗時のみ */
            if (!result.success) {
                setError(result.error);
            }
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
                登録済みの電話番号に SMS で確認コードを送信します。届いたコードを入力してログインを完了してください。
            </p>

            {challengeId === null ? (
                <Button type="button" onClick={handleSendCode} disabled={isPending} aria-busy={isPending}>
                    {isPending ? '送信中...' : 'SMS で確認コードを送信する'}
                </Button>
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
                        {isPending ? '確認中...' : 'ログインを完了する'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendCode}
                        disabled={isPending || cooldown > 0}
                    >
                        {cooldown > 0 ? `再送する（${cooldown} 秒後）` : '確認コードを再送する'}
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
