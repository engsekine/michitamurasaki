'use client';

import { useState } from 'react';

import { Button } from '@/shared/components/ui/Button';

interface SheetPreviewProps {
    /** buildSheetText で生成した全文（フォーム変更のたびに更新される） */
    generatedText: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * 生成テキストの全文表示 + 直接編集 + コピー（FR-006 / FR-013）。
 * 手動編集するとフォーム由来の再生成に追従しなくなり、「フォームの内容から再生成」で戻せる。
 * Clipboard API が使えない環境でも textarea から手動コピーできる。
 */
export const SheetPreview = ({ generatedText }: SheetPreviewProps) => {
    const [copyState, setCopyState] = useState<CopyState>('idle');
    // null = 未編集（生成テキストに追従）。文字列 = 手動編集された内容を優先
    const [editedText, setEditedText] = useState<string | null>(null);

    const displayText = editedText ?? generatedText;
    const isManuallyEdited = editedText !== null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(displayText);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor="sheet-preview-text" className="font-medium text-sm">
                生成テキスト
            </label>
            <p className="text-muted-foreground text-sm">
                出力はそのまま編集できます。編集した内容はコピーにも反映されます
            </p>
            <textarea
                id="sheet-preview-text"
                className="min-h-96 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm"
                value={displayText}
                onChange={(event) => setEditedText(event.target.value)}
            />
            {isManuallyEdited && (
                <p className="text-amber-700 text-sm">
                    手動編集中: フォームを変更しても出力には反映されません（「フォームの内容から再生成」で戻せます）
                </p>
            )}
            <div className="flex flex-col items-start gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        onClick={() => {
                            void handleCopy();
                        }}
                    >
                        コピーする
                    </Button>
                    {isManuallyEdited && (
                        <Button type="button" variant="outline" onClick={() => setEditedText(null)}>
                            フォームの内容から再生成
                        </Button>
                    )}
                </div>
                {/* aria-live 領域は常設して更新を通知する */}
                <span role="status" aria-live="polite" className="text-sky-700 text-sm">
                    {copyState === 'copied' ? 'コピーしました' : ''}
                </span>
                {copyState === 'failed' && (
                    <span role="alert" className="text-red-600 text-sm">
                        コピーできませんでした。テキストを選択して手動でコピーしてください
                    </span>
                )}
            </div>
        </div>
    );
};
