'use client';

import { XIcon } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

/** フォームのバディ 1 件（登録ユーザー userId か フリーテキスト name の一方）。spec 021 FR-002 */
export interface DiveBuddyValue {
    userId?: string | undefined;
    name?: string | undefined;
    /** 登録ユーザーの表示名（チップ表示用・保存には使わない） */
    nickname?: string | undefined;
}

interface DiveBuddyFieldProps {
    /** 現在のバディ配列（登録ユーザー + フリーテキスト混在可） */
    value: DiveBuddyValue[];
    /** 変更時に新しい配列を返す（react-hook-form 非依存の制御コンポーネント） */
    onChange: (value: DiveBuddyValue[]) => void;
    /** バリデーションエラー文言 */
    error?: string;
}

/**
 * 同行バディ入力（spec 021 US1）。
 * フリーテキストのバディ名を 0..n 行で追加・編集・削除できる。
 * 登録ユーザーのバディ（userId 保持）は、現状ユーザー検索 UI 未提供のため
 * 既存分をチップ表示・削除のみ可能（追加は US3 のユーザー検索導入後）。
 */
export const DiveBuddyField = ({ value, onChange, error }: DiveBuddyFieldProps) => {
    const registered = value.filter((buddy) => buddy.userId);
    const freetext = value.filter((buddy) => !buddy.userId);

    const emitFreetext = (nextFreetext: DiveBuddyValue[]) => onChange([...registered, ...nextFreetext]);

    const handleAdd = () => emitFreetext([...freetext, { name: '' }]);

    const handleNameChange = (index: number, name: string) => {
        emitFreetext(freetext.map((buddy, i) => (i === index ? { name } : buddy)));
    };

    const handleRemoveFreetext = (index: number) => {
        emitFreetext(freetext.filter((_, i) => i !== index));
    };

    const handleRemoveRegistered = (userId: string) => {
        onChange(value.filter((buddy) => buddy.userId !== userId));
    };

    return (
        <fieldset className="flex flex-col gap-3">
            <legend className="font-medium text-sm">同行したバディ</legend>

            {registered.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                    {registered.map((buddy) => (
                        <li
                            key={buddy.userId}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
                        >
                            <span>{buddy.nickname ?? '登録済みバディ'}</span>
                            <button
                                type="button"
                                onClick={() => buddy.userId && handleRemoveRegistered(buddy.userId)}
                                aria-label={`${buddy.nickname ?? '登録済みバディ'}を削除`}
                                className="inline-flex size-5 items-center justify-center rounded-full hover:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            >
                                <XIcon className="size-3.5" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <ul className="flex flex-col gap-2">
                {freetext.map((buddy, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: フリーテキスト行は安定 ID を持たないため index で識別する
                    <li key={index} className="flex items-center gap-2">
                        <label htmlFor={`dive-buddy-${index}`} className="sr-only">
                            バディ名 {index + 1}
                        </label>
                        <input
                            id={`dive-buddy-${index}`}
                            type="text"
                            value={buddy.name ?? ''}
                            onChange={(e) => handleNameChange(index, e.target.value)}
                            autoComplete="off"
                            placeholder="一緒に潜った人の名前"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <button
                            type="button"
                            onClick={() => handleRemoveFreetext(index)}
                            aria-label={`バディ ${index + 1} を削除`}
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                            <XIcon className="size-4" aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ul>

            <div>
                <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
                    バディを追加
                </Button>
            </div>

            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {error}
                </p>
            )}
        </fieldset>
    );
};
