import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createDive = vi.fn();
const createDiveFromPlan = vi.fn();
const updateDive = vi.fn();
const routerPush = vi.fn();
const routerRefresh = vi.fn();
const routerBack = vi.fn();

vi.mock('@/features/dives/server/actions', () => ({
    createDive: (...args: unknown[]) => createDive(...args),
    createDiveFromPlan: (...args: unknown[]) => createDiveFromPlan(...args),
    updateDive: (...args: unknown[]) => updateDive(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: routerRefresh, back: routerBack }),
}));

import { DiveForm } from './DiveForm';

describe('DiveForm', () => {
    beforeEach(() => {
        createDive.mockReset();
        createDiveFromPlan.mockReset();
        updateDive.mockReset();
        routerPush.mockReset();
        routerRefresh.mockReset();
    });

    it('必須項目（潜水日・ポイント名・最大水深・潜水時間）を表示する', () => {
        render(<DiveForm />);
        expect(screen.getByLabelText(/潜水日/)).toBeInTheDocument();
        expect(screen.getByLabelText(/ポイント名/)).toBeInTheDocument();
        expect(screen.getByLabelText(/最大水深\(m\)/)).toBeInTheDocument();
        expect(screen.getByLabelText(/潜水時間\(分\)/)).toBeInTheDocument();
    });

    it('新規作成成功時に詳細ページへ遷移する', async () => {
        createDive.mockResolvedValueOnce({ success: true, id: 'new-id' });
        const user = userEvent.setup();
        render(<DiveForm />);

        await user.clear(screen.getByLabelText(/ポイント名/));
        await user.type(screen.getByLabelText(/ポイント名/), '伊豆');
        await user.clear(screen.getByLabelText(/最大水深\(m\)/));
        await user.type(screen.getByLabelText(/最大水深\(m\)/), '18');
        await user.clear(screen.getByLabelText(/潜水時間\(分\)/));
        await user.type(screen.getByLabelText(/潜水時間\(分\)/), '45');

        await user.click(screen.getByRole('button', { name: '作成する' }));

        expect(createDive).toHaveBeenCalled();
        expect(routerPush).toHaveBeenCalledWith('/dives/new-id');
    });

    it('編集モードでは「更新する」ボタンを表示する', () => {
        render(<DiveForm diveId="existing-id" />);
        expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument();
    });

    it('エントリー / エキジット時刻を入力すると潜水時間が自動計算される', async () => {
        const user = userEvent.setup();
        render(<DiveForm />);

        const entry = screen.getByLabelText('エントリー時刻') as HTMLInputElement;
        const exit = screen.getByLabelText('エキジット時刻') as HTMLInputElement;
        const bottomTime = screen.getByLabelText(/潜水時間\(分\)/) as HTMLInputElement;

        await user.type(entry, '09:00');
        await user.type(exit, '09:45');

        expect(bottomTime.value).toBe('45');
        expect(screen.getByText('エントリー / エキジット時刻から自動計算します')).toBeInTheDocument();
    });

    it('潜水時間を手動編集すると以降は自動計算しない', async () => {
        const user = userEvent.setup();
        render(<DiveForm />);

        const entry = screen.getByLabelText('エントリー時刻') as HTMLInputElement;
        const exit = screen.getByLabelText('エキジット時刻') as HTMLInputElement;
        const bottomTime = screen.getByLabelText(/潜水時間\(分\)/) as HTMLInputElement;

        await user.type(entry, '09:00');
        await user.type(exit, '09:45');
        expect(bottomTime.value).toBe('45');

        await user.clear(bottomTime);
        await user.type(bottomTime, '60');
        expect(bottomTime.value).toBe('60');

        await user.clear(exit);
        await user.type(exit, '10:30');
        expect(bottomTime.value).toBe('60');
        expect(screen.queryByText('エントリー / エキジット時刻から自動計算します')).not.toBeInTheDocument();
    });

    it('編集モード（既存値あり）では自動計算しない', async () => {
        const user = userEvent.setup();
        render(<DiveForm diveId="existing-id" defaultValues={{ bottomTimeMin: 50 }} />);

        const bottomTime = screen.getByLabelText(/潜水時間\(分\)/) as HTMLInputElement;
        expect(bottomTime.value).toBe('50');
        expect(screen.queryByText('エントリー / エキジット時刻から自動計算します')).not.toBeInTheDocument();

        await user.type(screen.getByLabelText('エントリー時刻'), '09:00');
        await user.type(screen.getByLabelText('エキジット時刻'), '09:45');
        expect(bottomTime.value).toBe('50');
    });

    it('createDive がエラーを返すと alert を表示する', async () => {
        createDive.mockResolvedValueOnce({ success: false, error: '失敗しました' });
        const user = userEvent.setup();
        render(<DiveForm />);

        await user.clear(screen.getByLabelText(/ポイント名/));
        await user.type(screen.getByLabelText(/ポイント名/), '伊豆');
        await user.clear(screen.getByLabelText(/最大水深\(m\)/));
        await user.type(screen.getByLabelText(/最大水深\(m\)/), '18');
        await user.clear(screen.getByLabelText(/潜水時間\(分\)/));
        await user.type(screen.getByLabelText(/潜水時間\(分\)/), '45');

        await user.click(screen.getByRole('button', { name: '作成する' }));

        expect(await screen.findByText('失敗しました')).toBeInTheDocument();
    });

    it('creditBalance=0 では NoCreditBanner を先行表示する（026 FR-002）', () => {
        render(<DiveForm creditBalance={0} />);
        expect(screen.getByText('ログ枠がありません')).toBeInTheDocument();
    });

    it('creditBalance が 1 以上ならバナーを表示しない（026）', () => {
        render(<DiveForm creditBalance={5} />);
        expect(screen.queryByText('ログ枠がありません')).not.toBeInTheDocument();
    });

    it('編集モードでは creditBalance=0 でもバナーを表示しない（026 FR-010）', () => {
        render(<DiveForm diveId="existing-id" creditBalance={0} />);
        expect(screen.queryByText('ログ枠がありません')).not.toBeInTheDocument();
    });

    it("送信が code='no_credit' で拒否されると NoCreditBanner を表示し入力値を保持する（026 FR-002）", async () => {
        createDive.mockResolvedValueOnce({
            success: false,
            error: 'ログ枠がないため作成できません',
            code: 'no_credit',
        });
        const user = userEvent.setup();
        render(<DiveForm creditBalance={1} />);

        await user.clear(screen.getByLabelText(/ポイント名/));
        await user.type(screen.getByLabelText(/ポイント名/), '伊豆');
        await user.clear(screen.getByLabelText(/最大水深\(m\)/));
        await user.type(screen.getByLabelText(/最大水深\(m\)/), '18');
        await user.clear(screen.getByLabelText(/潜水時間\(分\)/));
        await user.type(screen.getByLabelText(/潜水時間\(分\)/), '45');

        await user.click(screen.getByRole('button', { name: '作成する' }));

        expect(await screen.findByText('ログ枠がありません')).toBeInTheDocument();
        // 入力値は保持される（再購入後にそのまま再送信できる）
        expect(screen.getByLabelText(/ポイント名/)).toHaveValue('伊豆');
        expect(routerPush).not.toHaveBeenCalled();
    });

    it('予定から引き継いだ初期値を表示し、編集できる（024 US1 / FR-007）', async () => {
        const user = userEvent.setup();
        render(
            <DiveForm
                fromPlanId="plan-1"
                defaultValues={{ diveDate: '2026-06-30', location: '伊豆 / 大瀬崎', notes: '外洋狙い' }}
            />,
        );

        const location = screen.getByLabelText(/ポイント名/) as HTMLInputElement;
        expect(location.value).toBe('伊豆 / 大瀬崎');
        expect((screen.getByLabelText(/潜水日/) as HTMLInputElement).value).toBe('2026-06-30');

        // 引き継ぎ値は初期値であり編集できる
        await user.clear(location);
        await user.type(location, '串本 / 備前');
        expect(location.value).toBe('串本 / 備前');
    });

    it('fromPlanId 指定で作成すると createDiveFromPlan を呼ぶ（024 US1）', async () => {
        createDiveFromPlan.mockResolvedValueOnce({ success: true, id: 'moved-id' });
        const user = userEvent.setup();
        render(<DiveForm fromPlanId="plan-1" defaultValues={{ diveDate: '2026-06-30', location: '伊豆 / 大瀬崎' }} />);

        await user.clear(screen.getByLabelText(/最大水深\(m\)/));
        await user.type(screen.getByLabelText(/最大水深\(m\)/), '18');
        await user.clear(screen.getByLabelText(/潜水時間\(分\)/));
        await user.type(screen.getByLabelText(/潜水時間\(分\)/), '45');

        await user.click(screen.getByRole('button', { name: '作成する' }));

        expect(createDiveFromPlan).toHaveBeenCalledWith('plan-1', expect.any(Object));
        expect(createDive).not.toHaveBeenCalled();
        expect(routerPush).toHaveBeenCalledWith('/dives/moved-id');
    });

    it('編集モードでは既存写真に ✕ を表示し、押すと削除予定にマークする', async () => {
        const user = userEvent.setup();
        render(
            <DiveForm
                diveId="d1"
                existingPhotos={[
                    {
                        id: 'p1',
                        displayUrl: '/display-p1.webp',
                        thumbUrl: '/thumb-p1.webp',
                        caption: '',
                        isCover: true,
                        width: 800,
                        height: 600,
                        alt: '海の写真',
                    },
                ]}
            />,
        );

        await user.click(screen.getByRole('button', { name: '海の写真 を削除' }));

        const toggled = screen.getByRole('button', { name: '海の写真 の削除を取り消す' });
        expect(toggled).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('削除予定')).toBeInTheDocument();
    });
});
