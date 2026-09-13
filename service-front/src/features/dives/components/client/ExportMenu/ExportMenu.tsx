'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { filterToSearchParams, parseDiveFilter } from '@/features/dives/lib/search-params';
import { Button } from '@/shared/components/ui/Button';

interface ExportMenuProps {
    /**
     * 出力対象を限定する ID 群（複数選択・単一出力）。
     * 未指定のときは現在の URL の絞り込み条件（機能 013）を引き継ぐ。
     */
    selectedIds?: string[];
    /** 操作を無効化する（0 件選択など） */
    disabled?: boolean;
}

const FORMATS = [
    { format: 'csv', label: 'CSV（バックアップ）' },
    { format: 'pdf', label: 'PDF（紙ログ提出）' },
] as const;

/**
 * ダイブログを CSV / PDF でダウンロードするメニュー（disclosure パターン）。
 * 各形式は `/dives/export` への `<a download>` リンクで、サーバー側がファイルを返す。
 */
export const ExportMenu = ({ selectedIds, disabled = false }: ExportMenuProps) => {
    const searchParams = useSearchParams();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const menuId = useId();

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        const onClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousedown', onClickOutside);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousedown', onClickOutside);
        };
    }, [isOpen]);

    /** 出力 URL を組み立てる。ids 指定があればそれを、無ければ現在の絞り込み条件を引き継ぐ */
    const buildHref = (format: 'csv' | 'pdf'): string => {
        const params =
            selectedIds && selectedIds.length > 0
                ? new URLSearchParams({ ids: selectedIds.join(',') })
                : filterToSearchParams(parseDiveFilter(new URLSearchParams(searchParams.toString())));
        params.set('format', format);
        return `/dives/export?${params.toString()}`;
    };

    return (
        <div ref={containerRef} className="relative">
            <Button
                type="button"
                variant="outline"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-controls={menuId}
                disabled={disabled}
                onClick={() => setIsOpen((open) => !open)}
            >
                エクスポート
            </Button>

            {isOpen && (
                <div
                    id={menuId}
                    role="menu"
                    className="absolute right-0 z-10 mt-1 flex min-w-48 flex-col rounded-md border border-border bg-background py-1 shadow-md"
                >
                    {FORMATS.map(({ format, label }) => (
                        <a
                            key={format}
                            role="menuitem"
                            href={buildHref(format)}
                            download
                            className="block px-4 py-2 text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                            onClick={() => setIsOpen(false)}
                        >
                            {label}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};
