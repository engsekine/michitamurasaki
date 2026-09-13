import { render, screen } from '@testing-library/react';

import { LANDING_FEATURES } from '@/features/landing/constants';

import { LandingFeatures } from './LandingFeatures';

describe('LandingFeatures', () => {
    it('constants の全機能（4 件）を見出しとして表示する', () => {
        render(<LandingFeatures />);
        for (const feature of LANDING_FEATURES) {
            expect(screen.getByRole('heading', { name: feature.title })).toBeInTheDocument();
        }
    });

    it('各機能の画面イメージに内容を説明する alt を付ける', () => {
        render(<LandingFeatures />);
        const images = screen.getAllByRole('img');
        expect(images).toHaveLength(LANDING_FEATURES.length);
        for (const feature of LANDING_FEATURES) {
            expect(screen.getByRole('img', { name: feature.imageAlt })).toBeInTheDocument();
        }
    });
});
