import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EmailOptInField } from './EmailOptInField';

describe('EmailOptInField', () => {
    it('ラベルと補足文（FR-011）を表示する', () => {
        render(<EmailOptInField id="emailOptIn" />);

        expect(screen.getByRole('checkbox', { name: /お知らせメールを受け取る/ })).toBeInTheDocument();
        expect(screen.getByText(/手続き上必要なメールは、この設定に関わらず送信されます/)).toBeInTheDocument();
    });

    it('初期状態では未チェック（任意・デフォルト不許可）', () => {
        render(<EmailOptInField id="emailOptIn" />);

        expect(screen.getByRole('checkbox', { name: /お知らせメールを受け取る/ })).not.toBeChecked();
    });

    it('クリックでチェックを切り替えられる', async () => {
        const user = userEvent.setup();
        const handleChange = vi.fn();
        render(<EmailOptInField id="emailOptIn" onChange={handleChange} />);

        await user.click(screen.getByRole('checkbox', { name: /お知らせメールを受け取る/ }));

        expect(handleChange).toHaveBeenCalled();
    });

    it('補足文を aria-describedby で関連付ける', () => {
        render(<EmailOptInField id="emailOptIn" />);

        const checkbox = screen.getByRole('checkbox', { name: /お知らせメールを受け取る/ });
        expect(checkbox).toHaveAttribute('aria-describedby', 'emailOptIn-description');
    });

    it('error を渡すと alert で表示し、エラーと補足文の両方を aria-describedby で結ぶ', () => {
        render(<EmailOptInField id="emailOptIn" error="エラーが発生しました" />);

        expect(screen.getByRole('alert')).toHaveTextContent('エラーが発生しました');
        expect(screen.getByRole('checkbox', { name: /お知らせメールを受け取る/ })).toHaveAttribute(
            'aria-describedby',
            'emailOptIn-error emailOptIn-description',
        );
    });
});
