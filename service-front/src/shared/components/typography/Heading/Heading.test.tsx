import { render, screen } from '@testing-library/react';

import { Heading } from './Heading';

describe('Heading', () => {
    describe('level による見出しタグのレンダリング', () => {
        it('level=1 のとき h1 要素としてレンダリングされる', () => {
            render(<Heading level={1}>ページタイトル</Heading>);
            expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        });

        it('level=2 のとき h2 要素としてレンダリングされる', () => {
            render(<Heading level={2}>セクション見出し</Heading>);
            expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
        });

        it('level=3 のとき h3 要素としてレンダリングされる', () => {
            render(<Heading level={3}>サブセクション見出し</Heading>);
            expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
        });

        it('level=4 のとき h4 要素としてレンダリングされる', () => {
            render(<Heading level={4}>小見出し</Heading>);
            expect(screen.getByRole('heading', { level: 4 })).toBeInTheDocument();
        });
    });

    describe('アクセシブルネームへの装飾バーの影響', () => {
        it('level=2 でアクセシブルネームは children のテキストのみ（装飾バーを含まない）', () => {
            render(<Heading level={2}>レポート一覧</Heading>);
            // aria-hidden="true" の span がアクセシブルネームに含まれないことを検証
            expect(screen.getByRole('heading', { name: 'レポート一覧' })).toBeInTheDocument();
        });

        it('level=3 でアクセシブルネームは children のテキストのみ（装飾バーを含まない）', () => {
            render(<Heading level={3}>詳細情報</Heading>);
            expect(screen.getByRole('heading', { name: '詳細情報' })).toBeInTheDocument();
        });
    });

    describe('アクセントバー（装飾 span）の有無', () => {
        it('level=1 のとき aria-hidden の装飾 span が存在しない', () => {
            const { container } = render(<Heading level={1}>ページタイトル</Heading>);
            expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
        });

        it('level=2 のとき aria-hidden="true" の装飾 span が存在する', () => {
            const { container } = render(<Heading level={2}>セクション見出し</Heading>);
            expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull();
        });

        it('level=3 のとき aria-hidden="true" の装飾 span が存在する', () => {
            const { container } = render(<Heading level={3}>サブセクション見出し</Heading>);
            expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull();
        });

        it('level=4 のとき aria-hidden の装飾 span が存在しない（小見出しはバーなし）', () => {
            const { container } = render(<Heading level={4}>小見出し</Heading>);
            expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
        });
    });

    describe('HTML 属性の透過', () => {
        it('id 属性が見出し要素に付与される', () => {
            render(
                <Heading level={2} id="section-summary">
                    概要
                </Heading>,
            );
            expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'section-summary');
        });

        it('aria-describedby 等の aria 属性が透過する', () => {
            render(
                <Heading level={1} aria-describedby="description">
                    アクセシビリティ
                </Heading>,
            );
            expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('aria-describedby', 'description');
        });
    });

    describe('className の上書き', () => {
        it('追加した className が見出し要素に付与される', () => {
            render(
                <Heading level={1} className="text-white">
                    タイトル
                </Heading>,
            );
            expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-white');
        });

        it('level=2 に追加した className が見出し要素に付与される', () => {
            render(
                <Heading level={2} className="text-red-500">
                    セクション
                </Heading>,
            );
            expect(screen.getByRole('heading', { level: 2 })).toHaveClass('text-red-500');
        });
    });
});
