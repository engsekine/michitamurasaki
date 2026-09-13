'use client';

import { RENTAL_ITEMS, YES_NO_OPTIONS } from '../../../constants';
import type { RentalItemKey, YesNoValue } from '../../../types';

interface RentalItemsFieldProps {
    hasRental: YesNoValue;
    onHasRentalChange: (value: YesNoValue) => void;
    selectedItems: RentalItemKey[];
    onSelectedItemsChange: (items: RentalItemKey[]) => void;
    omitRentalBlock: boolean;
    onOmitRentalBlockChange: (value: boolean) => void;
}

/**
 * レンタル器材の有無 + 品目 14 種の選択 + 省略トグル。
 * 「無」のときは品目・サイズ欄の入力を求めない（FR-011）。
 */
export const RentalItemsField = ({
    hasRental,
    onHasRentalChange,
    selectedItems,
    onSelectedItemsChange,
    omitRentalBlock,
    onOmitRentalBlockChange,
}: RentalItemsFieldProps) => {
    const handleItemToggle = (key: RentalItemKey, checked: boolean) => {
        if (checked) {
            onSelectedItemsChange([...selectedItems, key]);
            return;
        }
        onSelectedItemsChange(selectedItems.filter((item) => item !== key));
    };

    return (
        <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-1">
                <legend className="font-medium text-sm">レンタル器材の有無</legend>
                <div className="flex flex-wrap gap-4">
                    {YES_NO_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-center gap-1.5 text-sm">
                            <input
                                name="hasRental"
                                type="radio"
                                value={option.value}
                                checked={hasRental === option.value}
                                onChange={() => onHasRentalChange(option.value)}
                            />
                            {option.label}
                        </label>
                    ))}
                </div>
            </fieldset>

            {hasRental === 'yes' && (
                <fieldset className="flex flex-col gap-1">
                    <legend className="font-medium text-sm">レンタルしたい品目</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {RENTAL_ITEMS.map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 text-sm">
                                <input
                                    className="size-4 shrink-0"
                                    type="checkbox"
                                    value={key}
                                    checked={selectedItems.includes(key)}
                                    onChange={(event) => handleItemToggle(key, event.target.checked)}
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}

            {hasRental === 'no' && (
                <div className="flex items-center gap-2">
                    <input
                        id="omit-rental-block"
                        className="size-4 shrink-0"
                        type="checkbox"
                        checked={omitRentalBlock}
                        onChange={(event) => onOmitRentalBlockChange(event.target.checked)}
                    />
                    <label htmlFor="omit-rental-block" className="text-sm">
                        未該当ブロックを省略する（品目一覧・サイズ欄・コンタクトレンズ・度付きマスクを出力しない）
                    </label>
                </div>
            )}
        </div>
    );
};
