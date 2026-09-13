import { render, screen } from '@testing-library/react';

import { HERO_COPY } from '@/features/landing/constants';

import { LandingHero } from './LandingHero';

describe('LandingHero', () => {
    it('h1 としてキャッチコピーを表示する', () => {
        render(<LandingHero />);
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toHaveTextContent(HERO_COPY.title);
    });

    it('主要 CTA が新規登録（/signup）へのリンクである', () => {
        render(<LandingHero />);
        const cta = screen.getByRole('link', { name: HERO_COPY.primaryCtaLabel });
        expect(cta).toHaveAttribute('href', '/signup');
    });

    it('ログイン導線（/login）を表示する', () => {
        render(<LandingHero />);
        const login = screen.getByRole('link', { name: HERO_COPY.loginLabel });
        expect(login).toHaveAttribute('href', '/login');
    });
});
