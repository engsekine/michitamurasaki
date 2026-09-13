import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TermsAgreementField } from './TermsAgreementField';

describe('TermsAgreementField', () => {
    it('初期状態では同意チェックが無効（最後まで読むまでチェックできない）', () => {
        render(<TermsAgreementField id="agreedToTerms" />);

        expect(screen.getByRole('checkbox', { name: /利用規約に同意する/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: '利用規約を読む' })).toBeInTheDocument();
    });

    it('「利用規約を読む」で規約モーダルが開き、本文（条項見出し）が表示される', async () => {
        const user = userEvent.setup();
        render(<TermsAgreementField id="agreedToTerms" />);

        await user.click(screen.getByRole('button', { name: '利用規約を読む' }));

        expect(screen.getByRole('dialog', { name: '利用規約' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: '第1条（適用）' })).toBeInTheDocument();
    });

    it('最後まで読む（モーダルを開いてスクロール末尾に到達）と同意チェックが有効になる', async () => {
        const user = userEvent.setup();
        render(<TermsAgreementField id="agreedToTerms" />);

        // jsdom はレイアウトを計算せず scrollHeight/clientHeight が 0 のため、
        // スクロール領域マウント時点で「末尾到達」とみなされ既読になる（実ブラウザでは要スクロール）。
        await user.click(screen.getByRole('button', { name: '利用規約を読む' }));
        await user.keyboard('{Escape}'); // モーダルを閉じる

        expect(screen.getByRole('checkbox', { name: /利用規約に同意する/ })).toBeEnabled();
    });

    it('error を渡すと alert で表示される', () => {
        render(<TermsAgreementField id="agreedToTerms" error="利用規約に同意してください" />);

        expect(screen.getByRole('alert')).toHaveTextContent('利用規約に同意してください');
    });
});
