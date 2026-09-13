'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
    NOTIFICATION_TYPE_LABELS,
    NOTIFICATION_TYPES,
    type NotificationType,
} from '@/features/notifications/constants';
import { setNotificationPreference } from '@/features/notifications/server/actions';

interface NotificationSettingsProps {
    /** 種別ごとの受け取り設定。キーが無い種別は ON とみなす（行なし = ON） */
    initialPreferences: Record<string, boolean>;
}

/** 行なし = ON の規約に従い、全種別ぶんの ON/OFF を初期化する */
const buildInitialState = (initialPreferences: Record<string, boolean>): Record<NotificationType, boolean> =>
    Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, initialPreferences[type] ?? true])) as Record<
        NotificationType,
        boolean
    >;

/**
 * 通知設定の種別ごと ON/OFF トグル（025 / US3 / FR-011）。
 * 変更は即時 setNotificationPreference で保存する（楽観更新）。
 * 保存失敗時はエラーを表示してトグルを元に戻す（サーバー結果を真実とする）。
 */
export const NotificationSettings = ({ initialPreferences }: NotificationSettingsProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [preferences, setPreferences] = useState(() => buildInitialState(initialPreferences));
    const [error, setError] = useState<string | null>(null);

    const handleToggle = (type: NotificationType) => {
        const next = !preferences[type];
        setError(null);
        setPreferences((prev) => ({ ...prev, [type]: next }));
        startTransition(async () => {
            const result = await setNotificationPreference(type, next);
            if (!result.success) {
                setError(result.error);
                // 保存できていないため表示を保存前の状態へ戻す
                setPreferences((prev) => ({ ...prev, [type]: !next }));
                return;
            }
            router.refresh();
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
                OFF にした種別の通知は生成されません。ON に戻しても OFF 期間中の通知は届きません。
            </p>

            <ul className="flex flex-col divide-y divide-border">
                {NOTIFICATION_TYPES.map((type) => {
                    const isEnabled = preferences[type];
                    return (
                        <li key={type} className="flex items-center justify-between gap-3 py-3">
                            <span id={`notification-pref-${type}`} className="text-sm">
                                {NOTIFICATION_TYPE_LABELS[type]}
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                                {/* 状態は色だけに依存させず ON/OFF テキストでも示す（読み上げは aria-checked に委ねる） */}
                                <span aria-hidden="true" className="text-muted-foreground text-xs">
                                    {isEnabled ? 'ON' : 'OFF'}
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isEnabled}
                                    aria-labelledby={`notification-pref-${type}`}
                                    aria-busy={isPending}
                                    disabled={isPending}
                                    onClick={() => handleToggle(type)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 ${
                                        isEnabled ? 'bg-primary' : 'bg-muted-foreground/40'
                                    }`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`inline-block size-5 transform rounded-full bg-background transition-transform ${
                                            isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                                        }`}
                                    />
                                </button>
                            </span>
                        </li>
                    );
                })}
            </ul>

            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {error}
                </p>
            )}
        </div>
    );
};
