'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { DiveCard } from '@/features/dives/components/client/DiveCard';
import { DiveSearchBar } from '@/features/dives/components/client/DiveSearchBar';
import { ExportMenu } from '@/features/dives/components/client/ExportMenu';
import { useDives } from '@/features/dives/hooks/useDives';
import { filterToSearchParams, isSameFilter } from '@/features/dives/lib/search-params';
import type { DiveListFilter, DiveListPage } from '@/features/dives/types';
import { Button, buttonVariants } from '@/shared/components/ui/Button';

interface DiveListProps {
    /** SSR で取得した初回データ（initialFilter に対応） */
    initialPage: DiveListPage;
    /** SSR 取得時に使われたフィルタ（URL クエリ由来）。未指定は空フィルタ */
    initialFilter?: DiveListFilter;
}

export const DiveList = ({ initialPage, initialFilter = {} }: DiveListProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const [filter, setFilter] = useState<DiveListFilter>(initialFilter);

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError } = useDives(
        filter,
        initialPage,
        initialFilter,
    );

    const pages = data?.pages ?? [];
    const items = pages.flatMap((page) => page.items);
    const hasActiveFilter = !isSameFilter(filter, {});

    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    /** 読み込み済みの全件を選択／全解除（すべて選択済みなら解除） */
    const toggleSelectAll = () => {
        setSelectedIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((item) => item.id))));
    };

    const exitSelection = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
    };

    /** フィルタ適用時に state と URL クエリを同期する（再読み込み・共有で復元可能に） */
    const handleApplyFilter = (next: DiveListFilter) => {
        setFilter(next);
        const query = filterToSearchParams(next).toString();
        const target = (query ? `${pathname}?${query}` : pathname) as Route;
        router.replace(target, { scroll: false });
    };

    return (
        <div className="flex flex-col gap-4">
            {/* 適用中フィルタが外部から変わった（解除導線など）ときに入力値・開閉状態を確実に追従させるため、
                key に適用フィルタを与えて再マウントする。キー入力中は適用フィルタが変わらないため再マウントしない。 */}
            <DiveSearchBar
                key={filterToSearchParams(filter).toString()}
                initialFilter={filter}
                onSubmit={handleApplyFilter}
            />

            {items.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
                    >
                        {selectionMode ? '選択をやめる' : 'ログを選択してエクスポート'}
                    </Button>

                    {selectionMode && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span role="status" className="text-muted-foreground text-sm">
                                {selectedIds.size > 0
                                    ? `${selectedIds.size} 件選択中`
                                    : '出力するログを選択してください'}
                            </span>
                            <Button type="button" variant="outline" onClick={toggleSelectAll}>
                                {selectedIds.size === items.length ? 'すべて解除' : 'すべて選択'}
                            </Button>
                            <ExportMenu selectedIds={[...selectedIds]} disabled={selectedIds.size === 0} />
                        </div>
                    )}
                </div>
            )}

            {isError && (
                <p role="alert" className="text-red-600 text-sm">
                    ログの取得に失敗しました。時間をおいて再度お試しください。
                </p>
            )}

            {items.length === 0 && hasActiveFilter && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-border border-dashed bg-background p-8 text-center">
                    <p className="text-muted-foreground">検索条件に一致するログはありません</p>
                    <Button type="button" variant="outline" onClick={() => handleApplyFilter({})}>
                        フィルタを解除して全件表示
                    </Button>
                </div>
            )}

            {items.length === 0 && !hasActiveFilter && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-border border-dashed bg-background p-12 text-center">
                    <p className="text-muted-foreground">ログがまだありません</p>
                    <Link href="/dives/new" className={buttonVariants({ variant: 'default' })}>
                        最初のログを記録しよう
                    </Link>
                </div>
            )}

            <ul className="flex flex-col gap-3">
                {items.map((dive) => (
                    <li key={dive.id}>
                        <DiveCard
                            dive={dive}
                            selectable={selectionMode}
                            selected={selectedIds.has(dive.id)}
                            onToggleSelect={toggleSelect}
                        />
                    </li>
                ))}
            </ul>

            {hasNextPage && (
                <div className="flex justify-center">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            void fetchNextPage();
                        }}
                        disabled={isFetchingNextPage}
                        aria-busy={isFetchingNextPage}
                    >
                        {isFetchingNextPage ? '読み込み中...' : 'もっと見る'}
                    </Button>
                </div>
            )}
        </div>
    );
};
