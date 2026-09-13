import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DailyBonusModal } from './DailyBonusModal';

describe('DailyBonusModal', () => {
    it('マウント時にダイアログとして開き、タイトルと本文が支援技術に伝わる', () => {
        render(<DailyBonusModal remainingCredits={5} />);
        expect(screen.getByRole('dialog', { name: 'デイリーボーナス獲得！' })).toBeInTheDocument();
        expect(screen.getByText('ログ枠が 1 つ増えました')).toBeInTheDocument();
    });

    it('付与後の残り枠数を表示する（FR-002）', () => {
        render(<DailyBonusModal remainingCredits={5} />);
        expect(screen.getByText('現在の残り枠: 5')).toBeInTheDocument();
    });

    it('残り枠が取得できなかったとき（null）は枠数表示のみ省略する', () => {
        render(<DailyBonusModal remainingCredits={null} />);
        expect(screen.getByRole('dialog', { name: 'デイリーボーナス獲得！' })).toBeInTheDocument();
        expect(screen.queryByText(/現在の残り枠/)).not.toBeInTheDocument();
    });

    it('「ログを書く」導線がログ作成ページを指す（FR-004）', () => {
        render(<DailyBonusModal remainingCredits={5} />);
        expect(screen.getByRole('link', { name: 'ログを書く' })).toHaveAttribute('href', '/dives/new');
    });

    it('閉じるボタンで閉じられる（FR-003）', async () => {
        const user = userEvent.setup();
        render(<DailyBonusModal remainingCredits={5} />);

        await user.click(screen.getByRole('button', { name: '閉じる' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Esc キーで閉じられる（FR-003）', async () => {
        const user = userEvent.setup();
        render(<DailyBonusModal remainingCredits={5} />);

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
