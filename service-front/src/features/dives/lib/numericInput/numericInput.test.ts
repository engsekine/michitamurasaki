import type { KeyboardEvent, WheelEvent } from 'react';
import { vi } from 'vitest';

import { blockNonIntegerKeys, blurOnWheel } from './numericInput';

const createWheelEvent = () => {
    const blur = vi.fn();
    const event = { currentTarget: { blur } } as unknown as WheelEvent<HTMLInputElement>;
    return { event, blur };
};

const createKeyboardEvent = (key: string) => {
    const preventDefault = vi.fn();
    const event = { key, preventDefault } as unknown as KeyboardEvent<HTMLInputElement>;
    return { event, preventDefault };
};

describe('blurOnWheel', () => {
    it('ホイール操作で入力から blur する', () => {
        const { event, blur } = createWheelEvent();
        blurOnWheel(event);
        expect(blur).toHaveBeenCalledTimes(1);
    });
});

describe('blockNonIntegerKeys', () => {
    it.each(['e', 'E', '+', '-', '.', ','])("非整数キー '%s' は preventDefault される", (key) => {
        const { event, preventDefault } = createKeyboardEvent(key);
        blockNonIntegerKeys(event);
        expect(preventDefault).toHaveBeenCalledTimes(1);
    });

    it.each(['0', '9', 'Backspace', 'ArrowUp', 'Tab', 'Enter'])("許可キー '%s' は素通りする", (key) => {
        const { event, preventDefault } = createKeyboardEvent(key);
        blockNonIntegerKeys(event);
        expect(preventDefault).not.toHaveBeenCalled();
    });
});
