import type { KeyboardEvent, WheelEvent } from 'react';

/** number 入力にホイールでフォーカスしたまま値が変わる事故を防ぐ */
export const blurOnWheel = (e: WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
};

/** type=number でも入力できてしまう、非負整数として不正なキー */
const BLOCKED_INTEGER_KEYS = new Set(['e', 'E', '+', '-', '.', ',']);

/** type=number でも 'e' / '+' / '-' / '.' などは入力できてしまうのでブロックする（非負整数用） */
export const blockNonIntegerKeys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (BLOCKED_INTEGER_KEYS.has(e.key)) {
        e.preventDefault();
    }
};
