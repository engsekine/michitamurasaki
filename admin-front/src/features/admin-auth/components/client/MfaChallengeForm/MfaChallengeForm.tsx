'use client';

import { Button } from '@repo/ui/components/button';
import { useState, useTransition } from 'react';

import { verifyAdminLogin } from '@/features/admin-auth/server/mfaActions';

/** 認証アプリ（TOTP）ワンタイムコードの桁数。RFC 6238 の既定どおり 6 桁固定 */
const OTP_LENGTH = 6;
const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

interface MfaChallengeFormProps {
    /** 2 段階目で検証する TOTP 要素 ID（ページ側で listFactors から解決して渡す） */
    factorId: string;
}

/**
 * 管理者ログイン 2 段階目の認証アプリ（TOTP）コード入力フォーム。
 * TOTP はコードがアプリ側で生成されるため送信・再送の工程が無く、入力したコードを verifyAdminLogin で検証して AAL2 へ昇格する。
 * 検証成功時はサーバーアクションがダッシュボード（`/`）へ redirect するため、このフォームには戻らない。
 */
export const MfaChallengeForm = ({ factorId }: MfaChallengeFormProps) => {
    const [isPending, startTransition] = useTransition();
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleVerify = () => {
        setError(null);
        if (!OTP_PATTERN.test(code)) {
            setError(`${OTP_LENGTH} 桁の数字を入力してください`);
            return;
        }
        startTransition(async () => {
            const result = await verifyAdminLogin(factorId, code);
            /** 成功時はサーバー側 redirect のためここには来ない。到達するのは失敗時のみ */
            if (!result.success) {
                setError(result.error);
            }
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
                認証アプリに表示されている確認コードを入力してログインを完了してください。
            </p>

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

            {error && (
                <div role="alert" className="text-red-600 text-sm">
                    {error}
                </div>
            )}
        </div>
    );
};
