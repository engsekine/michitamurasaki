import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createPlan = vi.fn();
const updatePlan = vi.fn();
const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/features/plans/server/actions', () => ({
    createPlan: (...args: unknown[]) => createPlan(...args),
    updatePlan: (...args: unknown[]) => updatePlan(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

import { PlanForm } from './PlanForm';

describe('PlanForm', () => {
    beforeEach(() => {
        createPlan.mockReset();
        updatePlan.mockReset();
        routerPush.mockReset();
        routerRefresh.mockReset();
    });

    it('予定日・ポイント名・メモの入力欄を表示する', () => {
        render(<PlanForm />);
        expect(screen.getByLabelText(/予定日/)).toBeInTheDocument();
        expect(screen.getByLabelText(/ポイント名/)).toBeInTheDocument();
        expect(screen.getByLabelText(/メモ/)).toBeInTheDocument();
    });

    it('shopOptions があるとショップ選択欄を表示し、選択値が送信に含まれる（033）', async () => {
        createPlan.mockResolvedValueOnce({ success: true, id: 'new-plan-id' });
        const user = userEvent.setup();
        render(<PlanForm shopOptions={[{ id: 'shop-1', name: 'マリンステージ' }]} />);

        await user.type(screen.getByLabelText(/ポイント名/), '伊豆 / 富戸');
        await user.selectOptions(screen.getByLabelText(/ショップ/), 'shop-1');
        await user.click(screen.getByRole('button', { name: '作成する' }));

        expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({ diveShopId: 'shop-1' }));
    });

    it('shopOptions が空だとショップ登録への導線を表示し、選択欄は出さない（033）', () => {
        render(<PlanForm />);
        expect(screen.queryByLabelText(/ショップ/)).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'ショップを登録' })).toHaveAttribute('href', '/shops/new');
    });

    it('未選択のまま送信すると diveShopId は null で送信される（033）', async () => {
        createPlan.mockResolvedValueOnce({ success: true, id: 'new-plan-id' });
        const user = userEvent.setup();
        render(<PlanForm shopOptions={[{ id: 'shop-1', name: 'マリンステージ' }]} />);

        await user.type(screen.getByLabelText(/ポイント名/), '伊豆 / 富戸');
        await user.click(screen.getByRole('button', { name: '作成する' }));

        expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({ diveShopId: null }));
    });

    it('未選択のまま送信すると diveShopId は null で送信される（033）', async () => {
        createPlan.mockResolvedValueOnce({ success: true, id: 'new-plan-id' });
        const user = userEvent.setup();
        render(<PlanForm shopOptions={[{ id: 'shop-1', name: 'マリンステージ' }]} />);

        await user.type(screen.getByLabelText(/ポイント名/), '伊豆 / 富戸');
        await user.click(screen.getByRole('button', { name: '作成する' }));

        expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({ diveShopId: null }));
    });

    it('必須項目が未入力のまま送信するとエラーを表示し、アクションを呼ばない', async () => {
        const user = userEvent.setup();
        render(<PlanForm />);

        await user.click(screen.getByRole('button', { name: '作成する' }));

        expect(await screen.findByText('ポイント名を入力してください')).toBeInTheDocument();
        expect(createPlan).not.toHaveBeenCalled();
        expect(updatePlan).not.toHaveBeenCalled();
    });

    it('新規作成成功時に詳細ページへ遷移する', async () => {
        createPlan.mockResolvedValueOnce({ success: true, id: 'new-plan-id' });
        const user = userEvent.setup();
        render(<PlanForm />);

        await user.type(screen.getByLabelText(/ポイント名/), '伊豆 / 大瀬崎');
        await user.click(screen.getByRole('button', { name: '作成する' }));

        expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({ location: '伊豆 / 大瀬崎' }));
        expect(routerPush).toHaveBeenCalledWith('/plans/new-plan-id');
    });

    it('編集モードでは updatePlan を呼び、成功時に詳細ページへ遷移する', async () => {
        updatePlan.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(
            <PlanForm planId="existing-id" defaultValues={{ plannedOn: '2026-07-01', location: '沖縄 / 青の洞窟' }} />,
        );

        expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '更新する' }));

        expect(updatePlan).toHaveBeenCalledWith(
            'existing-id',
            expect.objectContaining({ plannedOn: '2026-07-01', location: '沖縄 / 青の洞窟' }),
        );
        expect(routerPush).toHaveBeenCalledWith('/plans/existing-id');
        expect(createPlan).not.toHaveBeenCalled();
    });

    it('createPlan がエラーを返すと alert を表示する', async () => {
        createPlan.mockResolvedValueOnce({ success: false, error: '予定の作成に失敗しました' });
        const user = userEvent.setup();
        render(<PlanForm />);

        await user.type(screen.getByLabelText(/ポイント名/), '伊豆');
        await user.click(screen.getByRole('button', { name: '作成する' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('予定の作成に失敗しました');
        expect(routerPush).not.toHaveBeenCalled();
    });
});
