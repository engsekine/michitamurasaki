import { replaceCachedDives, setLastFullSyncAt } from '../../../lib/db/dal';
import type { SqlDriver } from '../../../lib/db/types';

/** サーバーから取得した dives の 1 行（snake_case。表示に使う全列を含む） */
export interface ServerDiveRow {
    id: string;
    dive_date: string;
    [key: string]: unknown;
}

/**
 * dives の 1 ページ取得。
 * なぜ userId を受けるか: RLS は「本人のログ」に加えて「他人の公開ログ」も返す
 * （20260630100200 の公開読み取りポリシー）ため、RLS 任せでは他人のログが
 * 本人のキャッシュに混入する。取得側で必ず user_id を絞り込む。
 */
export type FetchDivesPage = (
    userId: string,
    cursor: { diveDate: string; id: string } | null,
    limit: number,
) => Promise<ServerDiveRow[]>;

/**
 * 全件同期（「オフライン用に同期」/ contracts/sync-protocol.md）。
 * keyset ページングで全件を集めてからキャッシュを置換する（途中失敗では置換しない = 既存キャッシュを守る）。
 * Web 側で削除されたログは置換により端末からも消える（FR-012）。
 */
export const runFullSync = async (
    driver: SqlDriver,
    userId: string,
    fetchPage: FetchDivesPage,
    now: string,
    pageSize = 100,
): Promise<{ count: number }> => {
    const all: ServerDiveRow[] = [];
    let cursor: { diveDate: string; id: string } | null = null;
    for (;;) {
        const page = await fetchPage(userId, cursor, pageSize);
        all.push(...page);
        if (page.length < pageSize) break;
        const last = page[page.length - 1];
        if (!last) break;
        cursor = { diveDate: last.dive_date, id: last.id };
    }

    await replaceCachedDives(
        driver,
        userId,
        all.map((row) => ({
            id: row.id,
            userId,
            diveDate: row.dive_date,
            payload: JSON.stringify(row),
            syncedAt: now,
        })),
    );
    await setLastFullSyncAt(driver, userId, now);
    return { count: all.length };
};
