import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCreditBalance = vi.fn();

vi.mock('@/features/credits/server/queries', () => ({
    getCreditBalance: () => getCreditBalance(),
}));

import { CreditBalanceBadge } from './CreditBalanceBadge';

describe('CreditBalanceBadge', () => {
    beforeEach(() => {
        getCreditBalance.mockReset();
    });

    it('残枠数をテキストで表示する（FR-013）', async () => {
        getCreditBalance.mockResolvedValue(7);
        render(await CreditBalanceBadge());

        expect(screen.getByText('残りログ枠')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('購入ページ（/settings/log-credits）へのリンクになっている', async () => {
        getCreditBalance.mockResolvedValue(7);
        render(await CreditBalanceBadge());

        const link = screen.getByRole('link', { name: '残りログ枠 7。ログ枠の購入ページへ' });
        expect(link).toHaveAttribute('href', '/settings/log-credits');
    });

    it('残枠 0 でも数値をテキストで判別できる（色のみに依存しない）', async () => {
        getCreditBalance.mockResolvedValue(0);
        render(await CreditBalanceBadge());

        expect(screen.getByText('残りログ枠')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
    });
});
