import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Route } from 'next';
import { HeaderMobileNav } from './HeaderMobileNav';

const NAV_ITEMS = [
    { href: '/dives' as Route, label: 'ダイビングログ' },
    { href: '/likes' as Route, label: 'いいね' },
] satisfies ReadonlyArray<{ href: Route; label: string }>;

describe('HeaderMobileNav', () => {
    it('aria-label="メニューを開く" のトリガーボタンを表示する', () => {
        render(<HeaderMobileNav items={NAV_ITEMS} />);

        expect(screen.getByRole('button', { name: 'メニューを開く' })).toBeInTheDocument();
    });

    it('初期状態ではシートが閉じており dialog が存在しない', () => {
        render(<HeaderMobileNav items={NAV_ITEMS} />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('トリガーをクリックすると「メニュー」という名前の dialog が開く', async () => {
        const user = userEvent.setup();
        render(<HeaderMobileNav items={NAV_ITEMS} />);

        await user.click(screen.getByRole('button', { name: 'メニューを開く' }));

        expect(await screen.findByRole('dialog', { name: 'メニュー' })).toBeInTheDocument();
    });

    it('シートが開くと items のリンクが正しい href 付きで表示される', async () => {
        const user = userEvent.setup();
        render(<HeaderMobileNav items={NAV_ITEMS} />);

        await user.click(screen.getByRole('button', { name: 'メニューを開く' }));

        const sheet = await screen.findByRole('dialog', { name: 'メニュー' });

        const divesLink = within(sheet).getByRole('link', { name: 'ダイビングログ' });
        expect(divesLink).toHaveAttribute('href', '/dives');

        const likesLink = within(sheet).getByRole('link', { name: 'いいね' });
        expect(likesLink).toHaveAttribute('href', '/likes');
    });

    it('シート内の nav が aria-label="メインナビゲーション" を持つ', async () => {
        const user = userEvent.setup();
        render(<HeaderMobileNav items={NAV_ITEMS} />);

        await user.click(screen.getByRole('button', { name: 'メニューを開く' }));

        const sheet = await screen.findByRole('dialog', { name: 'メニュー' });
        expect(within(sheet).getByRole('navigation', { name: 'メインナビゲーション' })).toBeInTheDocument();
    });

    it('リンクをクリックするとシートが閉じる（dialog が消える）', async () => {
        const user = userEvent.setup();
        render(<HeaderMobileNav items={NAV_ITEMS} />);

        await user.click(screen.getByRole('button', { name: 'メニューを開く' }));

        const sheet = await screen.findByRole('dialog', { name: 'メニュー' });
        await user.click(within(sheet).getByRole('link', { name: 'ダイビングログ' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('items が空配列でもクラッシュせず、シートを開いてもリンクが存在しない', async () => {
        const user = userEvent.setup();
        render(<HeaderMobileNav items={[]} />);

        await user.click(screen.getByRole('button', { name: 'メニューを開く' }));

        const sheet = await screen.findByRole('dialog', { name: 'メニュー' });
        expect(within(sheet).queryAllByRole('link')).toHaveLength(0);
    });

    it('items が 1 件のみでも正しく表示される', async () => {
        const user = userEvent.setup();
        const singleItem = [{ href: '/dives' as Route, label: 'ダイビングログ' }] satisfies ReadonlyArray<{
            href: Route;
            label: string;
        }>;
        render(<HeaderMobileNav items={singleItem} />);

        await user.click(screen.getByRole('button', { name: 'メニューを開く' }));

        const sheet = await screen.findByRole('dialog', { name: 'メニュー' });
        expect(within(sheet).getAllByRole('link')).toHaveLength(1);
        expect(within(sheet).getByRole('link', { name: 'ダイビングログ' })).toHaveAttribute('href', '/dives');
    });
});
