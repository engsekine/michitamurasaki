import { DELETED_USER_LABEL } from '@/features/notifications/constants';
import type { NotificationItem } from '@/features/notifications/server/queries';

import { buildNotificationMessage, formatOccurredAtJst, isNotificationActorDeleted } from './notificationDisplay';

const buildItem = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
    id: 'n1',
    type: 'followed',
    actorId: 'user-1',
    actorNickname: 'たろう',
    actorHandle: 'たろう',
    resourceId: null,
    occurredAt: '2026-07-01T12:00:00+09:00',
    readAt: null,
    ...overrides,
});

describe('formatOccurredAtJst', () => {
    it('timestamptz を JST の YYYY/MM/DD に整形する', () => {
        expect(formatOccurredAtJst('2026-07-01T12:00:00+09:00')).toBe('2026/07/01');
    });

    it('UTC 深夜は JST では翌日になる', () => {
        expect(formatOccurredAtJst('2026-06-30T23:00:00Z')).toBe('2026/07/01');
    });
});

describe('buildNotificationMessage', () => {
    it('nickname をメッセージに埋め込む', () => {
        expect(buildNotificationMessage(buildItem())).toContain('たろう');
    });

    it('actor 退会時は退会ラベルに落ちる', () => {
        expect(buildNotificationMessage(buildItem({ actorNickname: null }))).toContain(DELETED_USER_LABEL);
    });
});

describe('isNotificationActorDeleted', () => {
    it('ソーシャル通知で nickname が null なら true', () => {
        expect(isNotificationActorDeleted(buildItem({ type: 'followed', actorNickname: null }))).toBe(true);
        expect(isNotificationActorDeleted(buildItem({ type: 'buddy_tagged', actorNickname: null }))).toBe(true);
    });

    it('nickname が解決できていれば false', () => {
        expect(isNotificationActorDeleted(buildItem({ type: 'followed' }))).toBe(false);
    });
});
