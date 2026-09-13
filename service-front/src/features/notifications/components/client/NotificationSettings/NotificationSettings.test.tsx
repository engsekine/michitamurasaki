import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const setNotificationPreference = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh }),
}));

vi.mock('@/features/notifications/server/actions', () => ({
    setNotificationPreference: (...args: unknown[]) => setNotificationPreference(...args),
}));

import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES } from '@/features/notifications/constants';

import { NotificationSettings } from './NotificationSettings';

describe('NotificationSettings', () => {
    beforeEach(() => {
        setNotificationPreference.mockReset();
        refresh.mockReset();
    });

    it('全種別（5 種）のトグルをラベル付きで表示し、行なしの種別は ON になる', () => {
        render(<NotificationSettings initialPreferences={{}} />);

        for (const type of NOTIFICATION_TYPES) {
            const toggle = screen.getByRole('switch', { name: NOTIFICATION_TYPE_LABELS[type] });
            expect(toggle).toHaveAttribute('aria-checked', 'true');
        }
    });

    it('is_enabled = false の行がある種別は OFF、それ以外は ON になる', () => {
        render(<NotificationSettings initialPreferences={{ plan_reminder: false }} />);

        expect(screen.getByRole('switch', { name: NOTIFICATION_TYPE_LABELS.plan_reminder })).toHaveAttribute(
            'aria-checked',
            'false',
        );
        expect(screen.getByRole('switch', { name: NOTIFICATION_TYPE_LABELS.followed })).toHaveAttribute(
            'aria-checked',
            'true',
        );
    });

    it('トグルすると setNotificationPreference を呼び、成功時は表示が切り替わる', async () => {
        setNotificationPreference.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<NotificationSettings initialPreferences={{}} />);

        await user.click(screen.getByRole('switch', { name: NOTIFICATION_TYPE_LABELS.followed }));

        expect(setNotificationPreference).toHaveBeenCalledWith('followed', false);
        expect(screen.getByRole('switch', { name: NOTIFICATION_TYPE_LABELS.followed })).toHaveAttribute(
            'aria-checked',
            'false',
        );
        expect(refresh).toHaveBeenCalled();
    });

    it('OFF の種別をトグルすると enabled = true で保存する', async () => {
        setNotificationPreference.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<NotificationSettings initialPreferences={{ overhaul_reminder: false }} />);

        await user.click(screen.getByRole('switch', { name: NOTIFICATION_TYPE_LABELS.overhaul_reminder }));

        expect(setNotificationPreference).toHaveBeenCalledWith('overhaul_reminder', true);
    });

    it('保存失敗時は role="alert" でエラーを表示し、トグル表示を元に戻す', async () => {
        setNotificationPreference.mockResolvedValueOnce({ success: false, error: '通知設定の保存に失敗しました' });
        const user = userEvent.setup();
        render(<NotificationSettings initialPreferences={{}} />);

        await user.click(screen.getByRole('switch', { name: NOTIFICATION_TYPE_LABELS.buddy_tagged }));

        expect(await screen.findByRole('alert')).toHaveTextContent('通知設定の保存に失敗しました');
        expect(screen.getByRole('switch', { name: NOTIFICATION_TYPE_LABELS.buddy_tagged })).toHaveAttribute(
            'aria-checked',
            'true',
        );
        expect(refresh).not.toHaveBeenCalled();
    });
});
