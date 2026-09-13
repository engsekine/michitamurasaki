import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormCheckbox } from './FormCheckbox';

describe('FormCheckbox', () => {
    it('label と input を id で関連付ける', () => {
        render(<FormCheckbox id="agree" label="利用規約に同意する" />);
        const checkbox = screen.getByRole('checkbox', { name: '利用規約に同意する' });
        expect(checkbox).toBeInTheDocument();
    });

    it('label に ReactNode（リンク）を渡せる', () => {
        render(
            <FormCheckbox
                id="agree"
                label={
                    <>
                        <a href="/terms">利用規約</a>に同意する
                    </>
                }
            />,
        );
        expect(screen.getByRole('link', { name: '利用規約' })).toHaveAttribute('href', '/terms');
    });

    it('クリックでチェック状態が切り替わり onChange が呼ばれる', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<FormCheckbox id="agree" label="同意する" onChange={onChange} />);

        const checkbox = screen.getByRole('checkbox', { name: '同意する' });
        await user.click(checkbox);

        expect(checkbox).toBeChecked();
        expect(onChange).toHaveBeenCalled();
    });

    it('error を渡すと role="alert" で表示し aria-invalid になる', () => {
        render(<FormCheckbox id="agree" label="同意する" error="利用規約に同意してください" />);

        expect(screen.getByRole('alert')).toHaveTextContent('利用規約に同意してください');
        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('required で aria-required が付く', () => {
        render(<FormCheckbox id="agree" label="同意する" required />);
        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-required', 'true');
    });
});
