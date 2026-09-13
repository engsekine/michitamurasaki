import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SnsShareButtons } from './SnsShareButtons';

const TEXT = '伊豆 / 大瀬崎のダイビングログ（2026/04/15）| divlog';
const URL_VALUE = 'http://localhost:3000/dives/d1';

describe('SnsShareButtons', () => {
    it('X・Facebook の 2 つの共有ボタンをアクセシブルな名前付きで表示する', () => {
        render(<SnsShareButtons url={URL_VALUE} text={TEXT} />);
        expect(screen.getByRole('link', { name: 'X で共有' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Facebook で共有' })).toBeInTheDocument();
    });

    it('Instagram の共有ボタンは表示しない（2026-07-16 改定で削除）', () => {
        render(<SnsShareButtons url={URL_VALUE} text={TEXT} />);
        expect(screen.queryByRole('button', { name: /Instagram/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Instagram/ })).not.toBeInTheDocument();
    });

    it('X の共有リンクは intent URL にテキストと URL をエンコードして渡す', () => {
        // 記号・絵文字が URLSearchParams 経由で欠落しないこと（SC-002）
        const specialText = '#マンタ & 🐢のログ | divlog';
        render(<SnsShareButtons url={URL_VALUE} text={specialText} />);

        const href = screen.getByRole('link', { name: 'X で共有' }).getAttribute('href') ?? '';
        expect(href.startsWith('https://x.com/intent/post?')).toBe(true);
        const params = new URL(href).searchParams;
        expect(params.get('text')).toBe(specialText);
        expect(params.get('url')).toBe(URL_VALUE);
    });

    it('Facebook の共有リンクは sharer.php に URL をエンコードして渡す', () => {
        render(<SnsShareButtons url={URL_VALUE} text={TEXT} />);

        const href = screen.getByRole('link', { name: 'Facebook で共有' }).getAttribute('href') ?? '';
        expect(href.startsWith('https://www.facebook.com/sharer/sharer.php?')).toBe(true);
        expect(new URL(href).searchParams.get('u')).toBe(URL_VALUE);
    });

    it('X / Facebook のリンクは新しいタブで開き noopener noreferrer を付与する', () => {
        render(<SnsShareButtons url={URL_VALUE} text={TEXT} />);

        for (const name of ['X で共有', 'Facebook で共有']) {
            const link = screen.getByRole('link', { name });
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
    });
});
