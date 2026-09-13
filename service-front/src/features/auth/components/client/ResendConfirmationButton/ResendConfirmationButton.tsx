'use client';

import { useState, useTransition } from 'react';
import { resendConfirmationEmail } from '@/features/auth/server/actions';
import { Button } from '@/shared/components/ui/Button';
import { useCooldown } from '@/shared/hooks/useCooldown';

/** 連続再送を抑止するクールダウン秒数（FR-005） */
const COOLDOWN_SECONDS = 60;

interface ResendConfirmationButtonProps {
    /**
     * 再送先メールアドレス。サインアップ完了直後など宛先が分かっている場合に渡す。
     * 未指定の場合（ログイン画面の email_not_verified 導線など）はメール入力欄を表示する。
     */
    email?: string;
}

/**
 * サインアップ確認メールの再送ボタン（023 / FR-004）。
 * 送信後はクールダウン中ボタンを無効化し、結果を aria-live で通知する。
 */
export const ResendConfirmationButton = ({ email: fixedEmail }: ResendConfirmationButtonProps) => {
    const [isPending, startTransition] = useTransition();
    const [inputEmail, setInputEmail] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { cooldown, startCooldown } = useCooldown();

    const email = fixedEmail ?? inputEmail;
    const showEmailInput = fixedEmail === undefined;

    const handleClick = () => {
        setMessage(null);
        setError(null);
        startTransition(async () => {
            const result = await resendConfirmationEmail(email);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setMessage('確認メールを再送しました。メールをご確認ください。');
            startCooldown(COOLDOWN_SECONDS);
        });
    };

    const isDisabled = isPending || cooldown > 0 || email.trim() === '';
    const label = cooldown > 0 ? `再送する（${cooldown} 秒後に再試行できます）` : '確認メールを再送する';

    return (
        <div className="flex flex-col gap-2">
            {showEmailInput && (
                <label className="flex flex-col gap-1 text-sm">
                    <span>メールアドレス</span>
                    <input
                        type="email"
                        autoComplete="email"
                        value={inputEmail}
                        onChange={(e) => setInputEmail(e.target.value)}
                        className="rounded-md border border-border px-3 py-2 text-base"
                    />
                </label>
            )}

            <Button type="button" variant="outline" onClick={handleClick} disabled={isDisabled} aria-busy={isPending}>
                {isPending ? '再送中...' : label}
            </Button>

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
