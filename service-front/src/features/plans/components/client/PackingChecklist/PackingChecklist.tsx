'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { completePacking, togglePackingItem } from '@/features/plans/server/actions';
import type { PackingItem } from '@/features/plans/types';

interface PackingChecklistProps {
    /** 持ち物（表示順）。チェック済み・未チェックの全件を渡す */
    items: PackingItem[];
    /** hero: FV（写真背景）上のすりガラスカード用の白文字配色。default: 通常背景用 */
    variant?: 'default' | 'hero';
    /** 「準備完了にする」ボタン用の予定 id（037）。canComplete とセットで指定する */
    planId?: string;
    /** 「準備完了にする」ボタンを表示するか（037）。持ち物 0 件時はこの値にかかわらず表示しない（FR-007） */
    canComplete?: boolean;
}

/**
 * TOP「次の予定」カード用の持ち物チェックリスト。
 * 全項目をスクロール可能なリストで表示し、その場でチェック状態を切り替えられる。
 * 追加・削除は予定詳細（PackingList）に任せ、ここではトグルのみ提供する。
 */
export const PackingChecklist = ({
    items,
    variant = 'default',
    planId,
    canComplete = false,
}: PackingChecklistProps) => {
    const isHero = variant === 'hero';
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    const handleToggle = (item: PackingItem) => {
        setServerError(null);
        startTransition(async () => {
            const result = await togglePackingItem(item.id, !item.isChecked);
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            router.refresh();
        });
    };

    const handleComplete = () => {
        if (!planId) return;
        setServerError(null);
        startTransition(async () => {
            const result = await completePacking(planId);
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            router.refresh();
        });
    };

    if (items.length === 0) {
        return <p className={isHero ? 'text-white/70' : 'text-muted-foreground'}>持ち物はまだありません</p>;
    }

    return (
        <div className="flex flex-col gap-2">
            {serverError && (
                // 写真背景上では text-red-600 がコントラスト不足のため明るい赤に切り替える
                <p role="alert" className={isHero ? 'text-red-300' : 'text-red-600'}>
                    {serverError}
                </p>
            )}
            <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto pr-1">
                {items.map((item) => {
                    const checkboxId = `next-plan-packing-${item.id}`;
                    return (
                        <li key={item.id} className="flex items-center gap-2">
                            <input
                                id={checkboxId}
                                type="checkbox"
                                checked={item.isChecked}
                                disabled={isPending}
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
            {/* 準備完了（037）。未チェックが残っていても押せる（FR-002） */}
            {canComplete && planId && items.length > 0 && (
                <div className="flex">
                    <button
                        type="button"
                        disabled={isPending}
                        onClick={handleComplete}
                        className={
                            isHero
                                ? 'inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 font-bold text-[oklch(0.28_0.08_255)] text-sm transition-colors hover:bg-white/90 disabled:opacity-50'
                                : 'inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 font-bold text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-50'
                        }
                    >
                        準備完了にする
                    </button>
                </div>
            )}
        </div>
    );
};
