import type { ComponentPropsWithRef } from 'react';
import { Input } from '@/shared/components/ui/Input';

interface FormFieldProps extends ComponentPropsWithRef<'input'> {
    id: string;
    label: string;
    error?: string | undefined;
    required?: boolean;
}

export const FormField = ({ id, label, error, required, ...inputProps }: FormFieldProps) => {
    const errorId = `${id}-error`;

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="font-medium text-sm">
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
            <Input
                id={id}
                aria-required={required ? 'true' : undefined}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                {...inputProps}
            />
            {error && (
                <span id={errorId} role="alert" className="text-red-600 text-sm">
                    {error}
                </span>
            )}
        </div>
    );
};
