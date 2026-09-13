import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Mock } from 'jest-mock';

import { insertPendingDive } from '../../../lib/db/dal';
import { DiveForm } from './DiveForm';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'generated-uuid' }));
jest.mock('../../../lib/db/expoDriver', () => ({ getDriver: jest.fn(async () => ({})) }));
jest.mock('../../../lib/db/dal', () => ({ insertPendingDive: jest.fn(async () => undefined) }));
jest.mock('../../sync/engine', () => ({ runSyncQueue: jest.fn(async () => undefined) }));
jest.mock('../../../lib/supabase/client', () => ({ supabase: {} }));

interface PendingInput {
    id: string;
    userId: string;
    diveDate: string;
    payload: string;
    now: string;
}
type InsertMock = Mock<(driver: unknown, input: PendingInput) => Promise<void>>;
const mockedInsert = insertPendingDive as unknown as InsertMock;

const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('DiveForm', () => {
    beforeEach(() => {
        mockedInsert.mockClear();
    });

    it('必須項目が空のまま保存するとエラーを表示し、保存しない（FR-008 = Web と同一スキーマ）', async () => {
        const view = await render(<DiveForm userId={USER_ID} onSaved={jest.fn()} />);

        await fireEvent.press(view.getByRole('button', { name: 'ログを保存' }));

        expect(await view.findByText('最大水深を入力してください')).toBeTruthy();
        expect(view.getByText('潜水時間を入力してください')).toBeTruthy();
        expect(view.getByText('ポイントを選択するか、ポイント名を入力してください')).toBeTruthy();
        expect(mockedInsert).not.toHaveBeenCalled();
    });

    it('必須項目を入力して保存するとローカルへ書き込み、onSaved を呼ぶ（SC-001 = 通信なしで完了）', async () => {
        const onSaved = jest.fn();
        const view = await render(<DiveForm userId={USER_ID} onSaved={onSaved} />);

        await fireEvent.changeText(view.getByLabelText('ポイント名（必須）'), '大瀬崎');
        await fireEvent.changeText(view.getByLabelText('最大水深 m（必須）'), '18.5');
        await fireEvent.changeText(view.getByLabelText('潜水時間 分（必須）'), '40');
        await fireEvent.press(view.getByRole('button', { name: 'ログを保存' }));

        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(mockedInsert).toHaveBeenCalledTimes(1);
        const input = mockedInsert.mock.calls[0]?.[1];
        expect(input?.id).toBe('generated-uuid');
        expect(input?.userId).toBe(USER_ID);
        const payload = JSON.parse(input?.payload ?? '{}');
        expect(payload).toMatchObject({ location: '大瀬崎', maxDepthM: 18.5, bottomTimeMin: 40 });
    });
});
