import { render, screen } from '@testing-library/react';
import { Breadcrumbs } from './Breadcrumbs';

describe('Breadcrumbs', () => {
    it('常に「ホーム」リンクをルートに表示する', () => {
        render(<Breadcrumbs breadcrumbs={[{ name: '現在ページ' }]} />);

        const homeLink = screen.getByRole('link', { name: 'ホーム' });
        expect(homeLink).toBeInTheDocument();
        expect(homeLink).toHaveAttribute('href', '/');
    });

    it('slug を持つ階層はリンクとしてレンダリングする', () => {
        render(<Breadcrumbs breadcrumbs={[{ name: '設定', slug: '/settings' }, { name: '会員情報の編集' }]} />);

        const settingsLink = screen.getByRole('link', { name: '設定' });
        expect(settingsLink).toHaveAttribute('href', '/settings');
    });

    it('slug を持たない最終階層は現在ページとしてレンダリングする', () => {
        render(<Breadcrumbs breadcrumbs={[{ name: '会員情報の編集' }]} />);

        const currentPage = screen.getByText('会員情報の編集');
        expect(currentPage).toHaveAttribute('aria-current', 'page');
        expect(currentPage.tagName.toLowerCase()).not.toBe('a');
    });

    it('JSON-LD 構造化データを script タグで埋め込む', () => {
        const { container } = render(<Breadcrumbs breadcrumbs={[{ name: 'プライバシーポリシー' }]} />);

        const script = container.querySelector('script[type="application/ld+json"]');
        expect(script).not.toBeNull();

        const jsonLd = JSON.parse(script?.textContent ?? '{}');
        expect(jsonLd['@type']).toBe('BreadcrumbList');
        expect(jsonLd.itemListElement).toHaveLength(2);
        expect(jsonLd.itemListElement[0].position).toBe(1);
        expect(jsonLd.itemListElement[1].name).toBe('プライバシーポリシー');
    });

    it('name に </script> を含んでも JSON-LD の script 要素を閉じられない（XSS 回帰テスト）', () => {
        const maliciousName = '</script><script>alert(1)</script>&<img src=x>';
        const { container } = render(<Breadcrumbs breadcrumbs={[{ name: maliciousName }]} />);

        const script = container.querySelector('script[type="application/ld+json"]');
        expect(script).not.toBeNull();

        // 生の HTML には `<` `>` `&` が一切残らない（閉じタグ注入・HTML 解釈を不可能にする）
        const rawHtml = script?.innerHTML ?? '';
        expect(rawHtml).not.toContain('<');
        expect(rawHtml).not.toContain('>');
        expect(rawHtml).not.toContain('&');
        expect(rawHtml).toContain('\\u003c/script');

        // JSON としては等価（構造化データの意味は変わらない）
        const jsonLd = JSON.parse(script?.textContent ?? '{}');
        expect(jsonLd.itemListElement[1].name).toBe(maliciousName);
    });

    it('多階層の breadcrumb を順序通りに表示する', () => {
        render(
            <Breadcrumbs
                breadcrumbs={[
                    { name: 'ダイブログ', slug: '/dives' },
                    { name: '沖縄', slug: '/dives/okinawa' },
                    { name: '青の洞窟' },
                ]}
            />,
        );

        const list = screen.getByRole('navigation', { name: 'パンくずリスト' });
        const links = list.querySelectorAll('a');
        const labels = Array.from(links).map((a) => a.textContent);

        expect(labels).toEqual(['ホーム', 'ダイブログ', '沖縄']);
        expect(screen.getByText('青の洞窟')).toHaveAttribute('aria-current', 'page');
    });
});
