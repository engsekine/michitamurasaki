import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

import { ApplicationSheetForm } from './ApplicationSheetForm';

const saveApplicationSheet = vi.fn();
const saveApplicationBaseProfile = vi.fn();
const refresh = vi.fn();

vi.mock('../../../server/actions', () => ({
    saveApplicationSheet: (...args: unknown[]) => saveApplicationSheet(...args),
    saveApplicationBaseProfile: (...args: unknown[]) => saveApplicationBaseProfile(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh }),
}));

/** プレビュー textarea の現在値を返す */
const previewValue = (): string => (screen.getByLabelText('生成テキスト') as HTMLTextAreaElement).value;

describe('ApplicationSheetForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        saveApplicationSheet.mockResolvedValue({ success: true, id: 'sheet-new' });
        saveApplicationBaseProfile.mockResolvedValue({ success: true });
    });

    it('全入力項目が label 関連付けで存在する（レンタル依存の項目は「有」選択で表示）', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm />);

        // テキスト・数値・日付入力（レンタル選択に依存しない項目）
        for (const label of [
            'シート名',
            'お名前',
            '年齢',
            '生年月日',
            '携帯電話',
            '緊急連絡先の続柄',
            '緊急連絡先の電話番号',
            '最寄りの駅',
            'ライセンスランク',
            '経験本数',
            '最終ダイブ年月',
            '性別',
        ]) {
            expect(screen.getByLabelText(label)).toBeInTheDocument();
        }

        // 有無系ラジオグループ（fieldset legend）
        for (const legend of ['ドライスーツの経験', 'レンタル器材の有無']) {
            expect(screen.getByRole('group', { name: legend })).toBeInTheDocument();
        }

        // 伊豆・千葉/ボートダイビング経験は廃止済み（2026-07-11）
        expect(screen.queryByRole('group', { name: '伊豆・千葉でのダイビング経験' })).not.toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'ボートダイビングの経験' })).not.toBeInTheDocument();

        // デフォルトはレンタル「無」のため、「有」を選ぶと残りの項目が表示される（FR-011）
        const rentalGroup = screen.getByRole('group', { name: 'レンタル器材の有無' });
        await user.click(within(rentalGroup).getByLabelText('有'));

        for (const label of ['身長', '体重', '足のサイズ', 'コンタクトレンズの種類']) {
            expect(screen.getByLabelText(label)).toBeInTheDocument();
        }
        for (const legend of ['コンタクトレンズの有無', '度付きマスクレンタルの要否']) {
            expect(screen.getByRole('group', { name: legend })).toBeInTheDocument();
        }
    });

    it('入力した値がプレビューに反映される（FR-004）', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm />);

        await user.type(screen.getByLabelText('お名前'), '山田 太郎');

        expect(previewValue()).toContain('・お名前（山田 太郎）');
    });

    it('デフォルトはレンタル「無」+ 省略で、プレビューが「・レンタル器材（無）」で終わる', () => {
        render(<ApplicationSheetForm />);

        expect(previewValue()).toContain('・お名前（ ）');
        expect(previewValue()).toContain('・レンタル器材（無）');
        expect(previewValue()).not.toContain('ありの場合レンタルしたいものに○を付けてください');
        expect(previewValue()).not.toContain('・度付きのマスクレンタル必要の有無');
    });

    it('省略トグルを外すと空欄付きの全文が出力される（FR-005 / FR-012）', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm />);

        await user.click(screen.getByLabelText(/未該当ブロックを省略する/));

        expect(previewValue()).toContain('ありの場合レンタルしたいものに○を付けてください');
        expect(previewValue()).toContain('・度付きのマスクレンタル必要の有無（ ）');
    });

    it('バリデーションエラーが role="alert" と aria-invalid で表示される', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm />);

        const phoneInput = screen.getByLabelText('携帯電話');
        await user.type(phoneInput, '090-abcd');
        await user.tab();

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('携帯電話は数字とハイフンで入力してください');
        expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('defaultValues が各フィールドとプレビューに反映される', () => {
        render(<ApplicationSheetForm defaultValues={{ fullName: '佐藤 花子', licenseRank: 'Advanced' }} />);

        expect(screen.getByLabelText('お名前')).toHaveValue('佐藤 花子');
        expect(screen.getByLabelText('ライセンスランク')).toHaveValue('Advanced');
        expect(previewValue()).toContain('・お名前（佐藤 花子）');
    });

    it('自動入力された値を上書き修正すると出力に反映される（FR-008）', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm defaultValues={{ diveCount: '52' }} />);

        const diveCountInput = screen.getByLabelText('経験本数');
        expect(diveCountInput).toHaveValue('52');

        await user.clear(diveCountInput);
        await user.type(diveCountInput, '80');

        expect(previewValue()).toContain('・経験本数（80 本）');
    });

    it('デフォルトはレンタル「無」が選択され、サイズ欄・コンタクト・度付きマスクの入力欄が表示されない（FR-011）', () => {
        render(<ApplicationSheetForm />);

        const rentalGroup = screen.getByRole('group', { name: 'レンタル器材の有無' });
        expect(within(rentalGroup).getByLabelText('無')).toBeChecked();

        expect(screen.queryByLabelText('身長')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('体重')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('足のサイズ')).not.toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'コンタクトレンズの有無' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('コンタクトレンズの種類')).not.toBeInTheDocument();
        expect(screen.queryByRole('group', { name: '度付きマスクレンタルの要否' })).not.toBeInTheDocument();
    });

    it('ドライスーツの経験「有」を選んだときだけ経験本数の入力欄が表示される', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm />);

        expect(screen.queryByLabelText('ドライスーツの経験本数')).not.toBeInTheDocument();

        const drySuitGroup = screen.getByRole('group', { name: 'ドライスーツの経験' });
        await user.click(within(drySuitGroup).getByLabelText('有'));
        expect(screen.getByLabelText('ドライスーツの経験本数')).toBeInTheDocument();

        await user.click(within(drySuitGroup).getByLabelText('無'));
        expect(screen.queryByLabelText('ドライスーツの経験本数')).not.toBeInTheDocument();
    });

    it('最終ダイブ年月は「2026年7月」形式で入力してプレビューに反映される', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm />);

        await user.type(screen.getByLabelText('最終ダイブ年月'), '2026年7月');

        expect(previewValue()).toContain('・最終ダイブ年月（2026 年 7 月）');
    });

    it('「基本情報を保存」で saveApplicationBaseProfile が呼ばれ、完了が通知される', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm defaultValues={{ phone: '090-1234-5678' }} />);

        await user.click(screen.getByRole('button', { name: '基本情報を保存する' }));

        expect(saveApplicationBaseProfile).toHaveBeenCalledTimes(1);
        expect(saveApplicationBaseProfile).toHaveBeenCalledWith(expect.objectContaining({ phone: '090-1234-5678' }));
        expect(await screen.findByText('基本情報を保存しました')).toBeInTheDocument();
        expect(screen.getByText('基本情報を保存しました').closest('[role="status"]')).not.toBeNull();
    });

    it('「無」を選ぶと省略トグルに自動でチェックが入る（FR-012）', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm />);

        // デフォルト（無）でチェック済み
        const toggle = screen.getByLabelText(/未該当ブロックを省略する/);
        expect(toggle).toBeChecked();

        // 手動で外せる
        await user.click(toggle);
        expect(toggle).not.toBeChecked();

        // 有 → 無 と選び直すと再びチェックされる
        const rentalGroup = screen.getByRole('group', { name: 'レンタル器材の有無' });
        await user.click(within(rentalGroup).getByLabelText('有'));
        await user.click(within(rentalGroup).getByLabelText('無'));
        expect(screen.getByLabelText(/未該当ブロックを省略する/)).toBeChecked();
    });

    it('シート名を付けて保存すると saveApplicationSheet が呼ばれ、完了が role="status" で通知される（FR-010）', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm defaultValues={{ phone: '090-1234-5678' }} />);

        await user.type(screen.getByLabelText('シート名'), '〇〇ショップ用');
        await user.click(screen.getByRole('button', { name: 'シートを保存する' }));

        expect(saveApplicationSheet).toHaveBeenCalledTimes(1);
        expect(saveApplicationSheet).toHaveBeenCalledWith({
            sheetId: null,
            name: '〇〇ショップ用',
            values: expect.objectContaining({ phone: '090-1234-5678' }),
        });
        expect(await screen.findByText('保存しました')).toBeInTheDocument();
        expect(screen.getByText('保存しました').closest('[role="status"]')).not.toBeNull();
        expect(refresh).toHaveBeenCalled();
    });

    it('保存済みシートを開いた場合は上書き保存になり、シート名が初期表示される', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm sheetId="sheet-1" initialSheetName="〇〇ショップ用" />);

        expect(screen.getByLabelText('シート名')).toHaveValue('〇〇ショップ用');

        await user.click(screen.getByRole('button', { name: '上書き保存する' }));

        expect(saveApplicationSheet).toHaveBeenCalledWith({
            sheetId: 'sheet-1',
            name: '〇〇ショップ用',
            values: expect.anything(),
        });
    });

    it('新規保存に成功すると以降は上書き保存になる', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm />);

        await user.type(screen.getByLabelText('シート名'), '新しいシート');
        await user.click(screen.getByRole('button', { name: 'シートを保存する' }));

        expect(await screen.findByRole('button', { name: '上書き保存する' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '上書き保存する' }));

        expect(saveApplicationSheet).toHaveBeenLastCalledWith(expect.objectContaining({ sheetId: 'sheet-new' }));
    });

    it('保存に失敗するとエラーメッセージが role="alert" で表示される', async () => {
        const user = userEvent.setup();
        saveApplicationSheet.mockResolvedValue({
            success: false,
            error: 'シート名を入力してください',
        });
        render(<ApplicationSheetForm />);

        await user.click(screen.getByRole('button', { name: 'シートを保存する' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('シート名を入力してください');
    });

    it('shopOptions があると宛先ショップ選択欄が表示され、選択値が保存スナップショットに含まれる（033 / FR-009）', async () => {
        const user = userEvent.setup();
        render(<ApplicationSheetForm shopOptions={[{ id: 'shop-1', name: 'マリンステージ' }]} />);

        await user.selectOptions(screen.getByLabelText('宛先ショップ'), 'shop-1');
        await user.type(screen.getByLabelText('シート名'), '〇〇ショップ用');
        await user.click(screen.getByRole('button', { name: 'シートを保存する' }));

        expect(saveApplicationSheet).toHaveBeenCalledWith(
            expect.objectContaining({ values: expect.objectContaining({ diveShopId: 'shop-1' }) }),
        );
    });

    it('shopOptions が空だと宛先ショップ選択欄を出さず、ショップ登録への導線を表示する（033）', () => {
        render(<ApplicationSheetForm />);

        expect(screen.queryByLabelText('宛先ショップ')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'ショップを登録' })).toHaveAttribute('href', '/shops/new');
    });
});
