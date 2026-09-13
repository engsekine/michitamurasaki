import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCooldown } from './useCooldown';

describe('useCooldown', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('初期値は 0', () => {
        const { result } = renderHook(() => useCooldown());
        expect(result.current.cooldown).toBe(0);
    });

    /** 次の setTimeout は再レンダー後の effect で張られるため、1 秒ずつ act で進める */
    const advanceOneSecond = () => {
        act(() => {
            vi.advanceTimersByTime(1000);
        });
    };

    it('startCooldown で開始し、1 秒ごとに減って 0 で止まる', () => {
        const { result } = renderHook(() => useCooldown());

        act(() => {
            result.current.startCooldown(3);
        });
        expect(result.current.cooldown).toBe(3);

        advanceOneSecond();
        expect(result.current.cooldown).toBe(2);

        advanceOneSecond();
        advanceOneSecond();
        expect(result.current.cooldown).toBe(0);

        advanceOneSecond();
        expect(result.current.cooldown).toBe(0);
    });

    it('カウント中に startCooldown し直すと残り秒数がリセットされる', () => {
        const { result } = renderHook(() => useCooldown());

        act(() => {
            result.current.startCooldown(5);
        });
        advanceOneSecond();
        advanceOneSecond();
        expect(result.current.cooldown).toBe(3);

        act(() => {
            result.current.startCooldown(10);
        });
        expect(result.current.cooldown).toBe(10);
    });
});
