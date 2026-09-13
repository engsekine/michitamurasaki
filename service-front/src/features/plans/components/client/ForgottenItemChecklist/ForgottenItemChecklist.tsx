'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { toggleConfirmItem, uncompletePacking } from '@/features/plans/server/actions';
import type { PackingItem } from '@/features/plans/types';

interface ForgottenItemChecklistProps {
    /** 対象の予定 id（完了解除に使う） */
    planId: string;
    /** 持ち物（表示順）。isConfirmed を確認状態として使う */
    items: PackingItem[];
    /** 終了済み予定では操作を無効化する（FR-009）。既定は操作可能 */
    readOnly?: boolean;
    /** hero: FV（写真背景）上のすりガラスカード用の白文字配色。default: 通常背景用 */
    variant?: 'default' | 'hero';
}

/**
 * 忘れ物確認リスト（037）。準備完了後に持ち物リストと置き換えて表示する 2 周目チェック。
 * 全項目を「バッグに入れたか」観点で確認し直し、確認状態は準備チェックとは独立に保存される。
 * 確認トグル・完了解除は PackingChecklist と同じ「Server Action → router.refresh()」パターン。
 */
export const ForgottenItemChecklist = ({
    planId,
    items,
    readOnly = false,
    variant = 'default',
}: ForgottenItemChecklistProps) => {
    const isHero = variant === 'hero';
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    const totalCount = items.length;
    const confirmedCount = items.filter((item) => item.isConfirmed).length;
    const isAllConfirmed = totalCount > 0 && confirmedCount === totalCount;
    const progressPercent = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;

    const handleToggle = (item: PackingItem) => {
        setServerError(null);
        startTransition(async () => {
            const result = await toggleConfirmItem(item.id, !item.isConfirmed);
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            router.refresh();
        });
    };

    const handleUncomplete = () => {
        setServerError(null);
        startTransition(async () => {
            const result = await uncompletePacking(planId);
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <p className={isHero ? 'text-white/70' : 'text-muted-foreground'}>
                準備完了！出発前に忘れ物がないか最終確認しましょう
            </p>
            <p className={isHero ? 'font-semibold text-2xl text-white' : 'font-semibold text-2xl text-foreground'}>
                {confirmedCount}{' '}
                <span className={isHero ? 'font-normal text-white/70' : 'font-normal text-muted-foreground'}>
                    / {totalCount} 確認済み
                </span>
            </p>
            <div
                role="progressbar"
                aria-valuenow={confirmedCount}
                aria-valuemin={0}
                aria-valuemax={totalCount}
                aria-label="忘れ物確認の進捗"
                className={
                    isHero
                        ? 'h-2 w-full overflow-hidden rounded-full bg-white/20'
                        : 'h-2 w-full overflow-hidden rounded-full bg-border'
                }
            >
                {/* 進捗率は動的値のためインライン style を許容（css.md） */}
                <div
                    className={isHero ? 'h-full rounded-full bg-white' : 'h-full rounded-full bg-primary'}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
            {isAllConfirmed && (
                <p
                    role="status"
                    className={
                        isHero
                            ? 'rounded-lg bg-white/15 px-3 py-2 font-semibold text-white'
                            : 'rounded-lg bg-muted px-3 py-2 font-semibold text-foreground'
                    }
                >
                    忘れ物なし！すべての持ち物を確認しました
                </p>
            )}
            {serverError && (
                <p role="alert" className={isHero ? 'text-red-300' : 'text-red-600'}>
                    {serverError}
                </p>
            )}
            <ul className="flex max-h-60 flex-col gap-1.5 overflow-y-auto pr-1">
                {items.map((item) => {
                    const checkboxId = `forgotten-check-${item.id}`;
                    return (
                        <li key={item.id} className="flex items-center gap-2">
                            <input
                                id={checkboxId}
                                type="checkbox"
                                checked={item.isConfirmed}
                                disabled={isPending || readOnly}
                                onChange={() => handleToggle(item)}
                                className="size-4 shrink-0"
                            />
                            <label
                                htmlFor={checkboxId}
                                className={isHero ? 'flex-1 text-white' : 'flex-1 text-foreground'}
                            >
                                {item.name}
                            </label>
                        </li>
                    );
                })}
            </ul>
            {!readOnly && (
                <div className="flex">
                    <button
                        type="button"
                        disabled={isPending}
                        onClick={handleUncomplete}
                        className={
                            isHero
                                ? 'inline-flex h-9 items-center justify-center rounded-lg border border-white/40 px-4 font-bold text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50'
                                : 'inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 font-bold text-foreground text-sm transition-colors hover:bg-muted/50 disabled:opacity-50'
                        }
                    >
                        完了を解除
                    </button>
                </div>
            )}
        </div>
    );
};
