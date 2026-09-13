import { describe, expect, it } from 'vitest';

import { getNotificationTarget } from './notificationTarget';

describe('getNotificationTarget', () => {
    it('followed はユーザー ID の URL のプロフィールを返す（034 / FR-004）', () => {
        expect(
            getNotificationTarget({ type: 'followed', actorId: 'user-1', actorHandle: 'hanako', resourceId: null }),
        ).toEqual({
            href: '/users/hanako',
        });
    });

    it('followed で actorHandle が未取得なら内部 ID URL にフォールバックする', () => {
        expect(
            getNotificationTarget({ type: 'followed', actorId: 'user-1', actorHandle: null, resourceId: null }),
        ).toEqual({
            href: '/users/user-1',
        });
    });

    it('followed で actorId が null（退会）ならリンク無効', () => {
        expect(getNotificationTarget({ type: 'followed', actorId: null, actorHandle: null, resourceId: null })).toEqual(
            {
                href: null,
            },
        );
    });

    it('buddy_tagged は /dives/{resourceId} を返す', () => {
        expect(
            getNotificationTarget({
                type: 'buddy_tagged',
                actorId: 'user-1',
                actorHandle: null,
                resourceId: 'dive-1',
            }),
        ).toEqual({
            href: '/dives/dive-1',
        });
    });

    it('buddy_tagged で resourceId が null ならリンク無効', () => {
        expect(
            getNotificationTarget({ type: 'buddy_tagged', actorId: 'user-1', actorHandle: null, resourceId: null }),
        ).toEqual({
            href: null,
        });
    });

    it('plan_reminder は /plans/{resourceId} を返す', () => {
        expect(
            getNotificationTarget({ type: 'plan_reminder', actorId: null, actorHandle: null, resourceId: 'plan-1' }),
        ).toEqual({
            href: '/plans/plan-1',
        });
    });

    it('plan_reminder で resourceId が null ならリンク無効', () => {
        expect(
            getNotificationTarget({ type: 'plan_reminder', actorId: null, actorHandle: null, resourceId: null }),
        ).toEqual({
            href: null,
        });
    });

    it('log_liked は /dives/{resourceId} を返す（spec 027 US3）', () => {
        expect(
            getNotificationTarget({ type: 'log_liked', actorId: 'user-1', actorHandle: null, resourceId: 'dive-1' }),
        ).toEqual({
            href: '/dives/dive-1',
        });
    });

    it('log_liked で resourceId が null（ログ消滅）ならリンク無効', () => {
        expect(
            getNotificationTarget({ type: 'log_liked', actorId: 'user-1', actorHandle: null, resourceId: null }),
        ).toEqual({
            href: null,
        });
    });

    it('overhaul_reminder は resourceId によらず /settings/equipment を返す', () => {
        expect(
            getNotificationTarget({ type: 'overhaul_reminder', actorId: null, actorHandle: null, resourceId: null }),
        ).toEqual({
            href: '/settings/equipment',
        });
        expect(
            getNotificationTarget({
                type: 'overhaul_reminder',
                actorId: null,
                actorHandle: null,
                resourceId: 'reg-1',
            }),
        ).toEqual({
            href: '/settings/equipment',
        });
    });
});
