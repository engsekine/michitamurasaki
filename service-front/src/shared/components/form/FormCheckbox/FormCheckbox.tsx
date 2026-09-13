import type { ComponentPropsWithRef, ReactNode } from 'react';

interface FormCheckboxProps extends ComponentPropsWithRef<'input'> {
    id: string;
    /** ラベル内容。リンク等の ReactNode を渡せる（例: 利用規約リンク） */
    label: ReactNode;
    error?: string | undefined;
    required?: boolean | undefined;
}

/**
 * 汎用チェックボックス（react-hook-form の register をスプレッドして利用）。
 * label と input を htmlFor/id で関連付け、エラーは role="alert" + aria-describedby で結ぶ。
 */
export const FormCheckbox = ({ id, label, error, required, ...inputProps }: FormCheckboxProps) => {
    const errorId = `${id}-error`;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <input
                    id={id}
                    type="checkbox"
                    className="size-4 shrink-0"
                    aria-required={required ? 'true' : undefined}
                    aria-invalid={!!error}
                    aria-describedby={error ? errorId : undefined}
                    {...inputProps}
                />
                <label htmlFor={id} className="text-sm">
                    {label}
                    {required && (
                        <>
                            <span aria-hidden="true" className="ml-1 text-red-600">
                                *
                            </span>
                            <span className="sr-only">必須</span>
                        </>
                    )}
                </label>
            </div>
            {error && (
                <span id={errorId} role="alert" className="text-red-600 text-sm">
                    {error}
                </span>
            )}
        </div>
    );
};
