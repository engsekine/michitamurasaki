import { render, screen } from '@testing-library/react';

import { CTA_COPY } from '@/features/landing/constants';

import { LandingCta } from './LandingCta';

describe('LandingCta', () => {
    it('h2 として締めの見出しを表示する', () => {
        render(<LandingCta />);
        expect(screen.getByRole('heading', { level: 2, name: CTA_COPY.title })).toBeInTheDocument();
    });

    it('CTA が新規登録（/signup）へのリンクである', () => {
        render(<LandingCta />);
        const cta = screen.getByRole('link', { name: CTA_COPY.primaryCtaLabel });
        expect(cta).toHaveAttribute('href', '/signup');
    });
});
