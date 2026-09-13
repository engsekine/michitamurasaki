/**
 * notifications feature のバレル。
 * server 実装（queries は 'server-only'）はここから re-export せず、
 * 利用側が '@/features/notifications/server/queries' を直接 import する
 * （client バンドルへの server-only 混入を防ぐ / folder-structure.md）。
 */
export { NotificationList } from './components/client/NotificationList';
export { NotificationSettings } from './components/client/NotificationSettings';
export { NotificationBell } from './components/server/NotificationBell';
export type { NotificationType } from './constants';
export type { NotificationCursor, NotificationItem, NotificationPage } from './server/queries';
