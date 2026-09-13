import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

import type { SheetPrefill } from '../../../types';
import { ApplicationSheetIntroSection } from './ApplicationSheetIntroSection';

const getApplicationSheetPrefill = vi.fn();

vi.mock('../../../server/queries', () => ({
    getApplicationSheetPrefill: (...args: unknown[]) => getApplicationSheetPrefill(...args),
}));

const emptyPrefill: SheetPrefill = {
    fullName: null,
    birthOn: null,
    age: null,
    gender: null,
    heightCm: null,
    weightKg: null,
    licenseRank: null,
    diveCount: null,
    lastDiveYearMonth: null,
    phone: null,
    emergencyContactRelation: null,
    emergencyContactPhone: null,
    nearestStation: null,
    hasDrySuitExperience: null,
    drySuitDiveCount: null,
};

describe('ApplicationSheetIntroSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getApplicationSheetPrefill.mockResolvedValue(emptyPrefill);
    });

    it('見出し・説明・作成ページへの導線が表示される（FR-001）', async () => {
        render(await ApplicationSheetIntroSection());

        expect(screen.getByRole('heading', { name: '申し込みシート', level: 2 })).toBeInTheDocument();
        const link = screen.getByRole('link', { name: '申し込みシートを作る' });
        expect(link).toHaveAttribute('href', '/application-sheet');
    });

    it('登録内容から生成したテキストのプレビューが表示される', async () => {
        getApplicationSheetPrefill.mockResolvedValue({
            ...emptyPrefill,
            fullName: '山田 太郎',
            age: 36,
            licenseRank: 'Advanced Open Water Diver',
            diveCount: 52,
        });

        render(await ApplicationSheetIntroSection());

        const preview = screen.getByText(/・お名前（山田 太郎）/);
        expect(preview.textContent).toContain('・年齢（36 歳）');
        expect(preview.textContent).toContain('・ライセンス ランク（Advanced Open Water Diver）');
        expect(preview.textContent).toContain('・経験本数（52 本）');
    });

    it('プレビューはスクロール可能な領域としてキーボード操作できる（tabIndex + アクセシブルネーム）', async () => {
        render(await ApplicationSheetIntroSection());

        const preview = screen.getByRole('region', { name: 'あなたの登録内容で生成したプレビュー' });
        expect(preview).toHaveAttribute('tabindex', '0');
        expect(preview).toHaveClass('overflow-y-auto');
    });

    it('未登録ユーザーでも空欄の定型文プレビューが表示されエラーにならない（FR-009）', async () => {
        render(await ApplicationSheetIntroSection());

        const preview = screen.getByText(/・お名前（ ）/);
        expect(preview.textContent).toContain('・レンタル器材（無）');
    });

    it('機能の説明ポイントが表示される', async () => {
        render(await ApplicationSheetIntroSection());

        expect(screen.getByText(/プロフィールやログの登録内容から自動入力/)).toBeInTheDocument();
        expect(screen.getByText(/名前を付けて複数保存/)).toBeInTheDocument();
        expect(screen.getByText(/ワンタップでコピー/)).toBeInTheDocument();
    });
});
