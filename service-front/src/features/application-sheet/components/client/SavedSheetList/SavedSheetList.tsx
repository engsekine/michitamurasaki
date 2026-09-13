'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/shared/components/ui/Button';
import { formatJstDateTime } from '@/shared/lib/date';

import { deleteApplicationSheet } from '../../../server/actions';
import type { SavedSheetSummary } from '../../../types';

interface SavedSheetListProps {
    sheets: SavedSheetSummary[];
    /** 現在フォームに読み込んでいるシート ID（新規作成中は null） */
    selectedSheetId: string | null;
}

/**
 * 保存済みシートの一覧。選択（リンク遷移で読み込み）と削除を提供する。
 * 一覧の取得・並び順はサーバー側（listApplicationSheets）が担う。
 */
export const SavedSheetList = ({ sheets, selectedSheetId }: SavedSheetListProps) => {
    const router = useRouter();
    const [isDeleting, startDeleting] = useTransition();
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDelete = (sheet: SavedSheetSummary) => {
        if (!window.confirm(`「${sheet.name}」を削除しますか？この操作は取り消せません`)) return;

        setDeleteError(null);
        startDeleting(async () => {
            const result = await deleteApplicationSheet(sheet.id);
            if (!result.success) {
                setDeleteError(result.error);
                return;
            }
            // 開いているシートを消した場合は新規作成状態に戻す
            if (sheet.id === selectedSheetId) {
                router.push('/application-sheet');
                return;
            }
            router.refresh();
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                {sheets.map((sheet) => {
                    const isSelected = sheet.id === selectedSheetId;
                    return (
                        <li key={sheet.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <Link
                                href={`/application-sheet?sheet=${sheet.id}`}
                                aria-current={isSelected ? 'true' : undefined}
                                className="flex min-w-0 flex-col gap-0.5"
                            >
                                <span className="truncate font-medium text-sm underline-offset-4 hover:underline">
                                    {sheet.name}
                                    {isSelected && <span className="ml-2 text-sky-700 text-xs">編集中</span>}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    更新: {formatJstDateTime(sheet.updatedAt)}
                                </span>
                            </Link>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label={`${sheet.name}を削除`}
                                disabled={isDeleting}
                                onClick={() => handleDelete(sheet)}
                            >
                                削除
                            </Button>
                        </li>
                    );
                })}
            </ul>
            {deleteError && (
                <span role="alert" className="text-red-600 text-sm">
                    {deleteError}
                </span>
            )}
        </div>
    );
};
