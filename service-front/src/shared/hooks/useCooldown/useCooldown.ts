'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 秒単位のクールダウンタイマー。再送ボタン等の連打抑止に使う。
 * `startCooldown(seconds)` で開始し、`cooldown` が 1 秒ごとに 0 までカウントダウンする。
 */
export const useCooldown = (): { cooldown: number; startCooldown: (seconds: number) => void } => {
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const startCooldown = useCallback((seconds: number) => setCooldown(seconds), []);

    return { cooldown, startCooldown };
};
