import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TimelineTabs } from './TimelineTabs';

describe('TimelineTabs', () => {
    describe('ナビゲーション構造', () => {
        it('aria-label="閲覧の切り替え" を持つ nav 要素を表示する', () => {
            render(<TimelineTabs active="timeline" />);

            expect(screen.getByRole('navigation', { name: '閲覧の切り替え' })).toBeInTheDocument();
        });

        it('「タイムライン」リンクの href が "/" である', () => {
            render(<TimelineTabs active="timeline" />);

            expect(screen.getByRole('link', { name: 'タイムライン' })).toHaveAttribute('href', '/');
        });

        it('「いいねしたログ」リンクの href が "/likes" である', () => {
            render(<TimelineTabs active="timeline" />);

            expect(screen.getByRole('link', { name: 'いいねしたログ' })).toHaveAttribute('href', '/likes');
        });
    });

    describe('active="timeline" のとき', () => {
        it('「タイムライン」リンクに aria-current="page" が付く', () => {
            render(<TimelineTabs active="timeline" />);

            expect(screen.getByRole('link', { name: 'タイムライン' })).toHaveAttribute('aria-current', 'page');
        });

        it('「いいねしたログ」リンクに aria-current が付かない', () => {
            render(<TimelineTabs active="timeline" />);

            expect(screen.getByRole('link', { name: 'いいねしたログ' })).not.toHaveAttribute('aria-current');
        });
    });

    describe('active="likes" のとき', () => {
        it('「いいねしたログ」リンクに aria-current="page" が付く', () => {
            render(<TimelineTabs active="likes" />);

            expect(screen.getByRole('link', { name: 'いいねしたログ' })).toHaveAttribute('aria-current', 'page');
        });

        it('「タイムライン」リンクに aria-current が付かない', () => {
            render(<TimelineTabs active="likes" />);

            expect(screen.getByRole('link', { name: 'タイムライン' })).not.toHaveAttribute('aria-current');
        });
    });
});
