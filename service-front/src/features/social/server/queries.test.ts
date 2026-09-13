import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/shared/lib/supabase/server';

import {
    fetchDiveLikeState,
    fetchFollowLists,
    fetchFollowState,
    fetchLikedDives,
    fetchTimeline,
    resolveProfileSlug,
    resolveUserIdByHandle,
    searchUsers,
} from './queries';

const mockedCreateClient = vi.mocked(createClient);

const VIEWER_ID = '11111111-1111-1111-1111-111111111111';
const TARGET_ID = '22222222-2222-2222-2222-222222222222';

interface QueryResult {
    data?: unknown;
    error?: { message: string } | null;
    count?: number;
}

/** モックのチェーンメソッド名（すべて自身を返す） */
const CHAIN_METHODS = ['select', 'eq', 'in', 'order', 'limit', 'lt', 'or'] as const;

type MockBuilder = Record<(typeof CHAIN_METHODS)[number], ReturnType<typeof vi.fn>> & {
    then: (resolve: (value: QueryResult) => void) => void;
};

/**
 * Supabase クエリビルダーのモック。チェーンメソッドは自身を返し、
 * 最終 await（thenable）で渡した result を解決する（export-query.test.ts と同方針）。
 */
const makeBuilder = (result: QueryResult): MockBuilder => {
    const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        lt: vi.fn(),
        or: vi.fn(),
        // biome-ignore lint/suspicious/noThenProperty: Supabase クエリビルダーは thenable のためモックでも then を実装する
        then: (resolve: (value: QueryResult) => void) => resolve(result),
    } satisfies MockBuilder;
    for (const method of CHAIN_METHODS) {
        builder[method].mockReturnValue(builder);
    }
    return builder;
};

/**
 * from() 呼び出しごとに fromResults を順番に返すクライアントモック。
 * rpc は nicknames（get_user_public_profiles）解決に使う。
 */
const buildClient = (options: {
    user?: { id: string } | null;
    fromResults?: QueryResult[];
    rpcResult?: QueryResult;
}) => {
    const { user = { id: VIEWER_ID }, fromResults = [], rpcResult = { data: [], error: null } } = options;
    const queue = [...fromResults];
    const builders: ReturnType<typeof makeBuilder>[] = [];
    const from = vi.fn(() => {
        const builder = makeBuilder(queue.shift() ?? { data: [], error: null });
        builders.push(builder);
        return builder;
    });
    const rpc = vi.fn().mockResolvedValue(rpcResult);
    const getUser = vi.fn().mockResolvedValue({ data: { user } });

    const client = { from, rpc, auth: { getUser } };
    mockedCreateClient.mockResolvedValue(client as never);

    return { client, from, rpc, builders };
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('resolveUserIdByHandle', () => {
    it('RPC get_user_id_by_handle を呼び user_id を返す（034 / FR-001）', async () => {
        const { rpc } = buildClient({ rpcResult: { data: TARGET_ID, error: null } });

        await expect(resolveUserIdByHandle('buddy-taro')).resolves.toBe(TARGET_ID);
        expect(rpc).toHaveBeenCalledWith('get_user_id_by_handle', { p_handle: 'buddy-taro' });
    });

    it('該当なし（data=null）は null を返す', async () => {
        buildClient({ rpcResult: { data: null, error: null } });

        await expect(resolveUserIdByHandle('no-such-user')).resolves.toBeNull();
    });

    it('RPC エラーは throw する', async () => {
        buildClient({ rpcResult: { data: null, error: { message: 'boom' } } });

        await expect(resolveUserIdByHandle('x')).rejects.toThrow('ユーザー ID の解決に失敗しました');
    });
});

describe('resolveProfileSlug', () => {
    it('ユーザー ID slug は user_id に解決して ok を返す（大文字は小文字に正規化 = FR-002）', async () => {
        const { rpc } = buildClient({ rpcResult: { data: TARGET_ID, error: null } });

        await expect(resolveProfileSlug('BUDDY-TARO')).resolves.toEqual({
            kind: 'ok',
            userId: TARGET_ID,
        });
        expect(rpc).toHaveBeenCalledWith('get_user_id_by_handle', { p_handle: 'buddy-taro' });
    });

    it('解決できないユーザー ID は null（FR-007）', async () => {
        buildClient({ rpcResult: { data: null, error: null } });

        await expect(resolveProfileSlug('no-such-user')).resolves.toBeNull();
    });

    it('uuid slug は handle を解決し、ユーザー ID の URL への redirect を返す（FR-005）', async () => {
        const { rpc } = buildClient({
            rpcResult: { data: [{ user_id: TARGET_ID, nickname: 'バディ', handle: 'buddy-taro' }], error: null },
        });

        await expect(resolveProfileSlug(TARGET_ID)).resolves.toEqual({
            kind: 'redirect',
            nicknamePath: '/users/buddy-taro',
        });
        expect(rpc).toHaveBeenCalledWith('get_user_public_profiles', { p_ids: [TARGET_ID] });
    });

    it('uuid slug で該当ユーザーがいなければ null', async () => {
        buildClient({ rpcResult: { data: [], error: null } });

        await expect(resolveProfileSlug(TARGET_ID)).resolves.toBeNull();
    });

    it('不正なパーセントエンコードは null（decodeURIComponent 失敗）', async () => {
        buildClient({});

        await expect(resolveProfileSlug('%E3%81')).resolves.toBeNull();
    });
});

describe('fetchFollowState', () => {
    it('isFollowing と follower/following 件数を集約して返す', async () => {
        // 1: フォロー判定（count=1）, 2: フォロワー数（count=3）, 3: フォロー中数（count=5）
        buildClient({
            fromResults: [{ count: 1 }, { count: 3 }, { count: 5 }],
        });

        const state = await fetchFollowState(TARGET_ID);

        expect(state).toEqual({ isFollowing: true, followerCount: 3, followingCount: 5 });
    });

    it('フォロー関係が無ければ isFollowing=false', async () => {
        buildClient({ fromResults: [{ count: 0 }, { count: 0 }, { count: 0 }] });

        const state = await fetchFollowState(TARGET_ID);

        expect(state.isFollowing).toBe(false);
        expect(state.followerCount).toBe(0);
        expect(state.followingCount).toBe(0);
    });

    it('未ログインでも件数は集計し isFollowing=false を返す', async () => {
        // 未ログインなら判定クエリは走らず、件数 2 本のみ from される
        buildClient({ user: null, fromResults: [{ count: 7 }, { count: 2 }] });

        const state = await fetchFollowState(TARGET_ID);

        expect(state).toEqual({ isFollowing: false, followerCount: 7, followingCount: 2 });
    });
});

describe('fetchFollowLists', () => {
    it('following 一覧で相手 nickname と自分のフォロー状態を付与する', async () => {
        const { from, builders, rpc } = buildClient({
            // 1: 一覧本体（followee_id 行）, 2: 閲覧者のフォロー集合
            fromResults: [
                { data: [{ followee_id: TARGET_ID, created_at: '2026-06-01T00:00:00Z' }], error: null },
                { data: [{ followee_id: TARGET_ID }], error: null },
            ],
            rpcResult: { data: [{ user_id: TARGET_ID, nickname: 'はなこ', handle: 'hanako' }], error: null },
        });

        const { items, nextCursor } = await fetchFollowLists(VIEWER_ID, 'following');

        expect(from).toHaveBeenCalledWith('user_follows');
        // following 一覧は follower_id で絞る
        expect(builders[0]?.eq).toHaveBeenCalledWith('follower_id', VIEWER_ID);
        expect(rpc).toHaveBeenCalledWith('get_user_public_profiles', { p_ids: [TARGET_ID] });
        expect(items).toEqual([{ userId: TARGET_ID, nickname: 'はなこ', handle: 'hanako', isFollowing: true }]);
        expect(nextCursor).toBeNull();
    });

    it('followers 一覧は followee_id で絞り、未解決 nickname はフォールバック表示する', async () => {
        const { builders } = buildClient({
            fromResults: [
                { data: [{ follower_id: VIEWER_ID, created_at: '2026-06-01T00:00:00Z' }], error: null },
                { data: [], error: null },
            ],
            rpcResult: { data: [], error: null },
        });

        const { items } = await fetchFollowLists(TARGET_ID, 'followers');

        expect(builders[0]?.eq).toHaveBeenCalledWith('followee_id', TARGET_ID);
        expect(items).toEqual([{ userId: VIEWER_ID, nickname: '（不明なユーザー）', handle: '', isFollowing: false }]);
    });

    it('limit+1 件取れたら次ページ用カーソルを返す', async () => {
        const rows = [
            { followee_id: 'a', created_at: '2026-06-03T00:00:00Z' },
            { followee_id: 'b', created_at: '2026-06-02T00:00:00Z' },
            { followee_id: 'c', created_at: '2026-06-01T00:00:00Z' },
        ];
        buildClient({
            fromResults: [
                { data: rows, error: null },
                { data: [], error: null },
            ],
            rpcResult: { data: [], error: null },
        });

        const { items, nextCursor } = await fetchFollowLists(VIEWER_ID, 'following', { limit: 2 });

        expect(items).toHaveLength(2);
        // 2 件目（最後に表示する行）の created_at がカーソル
        expect(nextCursor).toBe('2026-06-02T00:00:00Z');
    });

    it('エラー時は throw する', async () => {
        buildClient({
            fromResults: [{ data: null, error: { message: 'permission denied' } }],
        });

        await expect(fetchFollowLists(VIEWER_ID, 'following')).rejects.toThrow(/permission denied/);
    });
});

describe('fetchTimeline', () => {
    it('未ログインなら空ページを返す', async () => {
        const { from } = buildClient({ user: null });

        const page = await fetchTimeline();

        expect(page).toEqual({ items: [], nextCursor: null });
        expect(from).not.toHaveBeenCalled();
    });

    it('フォロー 0 件なら dives を引かず空ページを返す', async () => {
        const { from } = buildClient({
            fromResults: [{ data: [], error: null }], // フォロー集合が空
        });

        const page = await fetchTimeline();

        expect(page).toEqual({ items: [], nextCursor: null });
        // user_follows のみ引いて dives は引かない
        expect(from).toHaveBeenCalledTimes(1);
        expect(from).toHaveBeenCalledWith('user_follows');
    });

    it('フォロー集合 × 公開ログを新しい順で取得し、いいね情報付きの TimelineItem に整形する', async () => {
        const { from, builders } = buildClient({
            fromResults: [
                // 1: フォロー集合
                { data: [{ followee_id: TARGET_ID }], error: null },
                // 2: 公開 dives
                {
                    data: [
                        {
                            id: 'd1',
                            user_id: TARGET_ID,
                            dive_date: '2026-06-10',
                            location: '大瀬崎',
                            max_depth_m: '18.5',
                            bottom_time_min: 45,
                        },
                    ],
                    error: null,
                },
                // 3: dive_likes（バッチ 1 クエリ。件数 + 閲覧者のいいね済み判定の両方に使う）
                {
                    data: [
                        { dive_id: 'd1', user_id: VIEWER_ID },
                        { dive_id: 'd1', user_id: TARGET_ID },
                    ],
                    error: null,
                },
            ],
            rpcResult: { data: [{ user_id: TARGET_ID, nickname: 'はなこ', handle: 'hanako' }], error: null },
        });

        const page = await fetchTimeline();

        expect(from).toHaveBeenNthCalledWith(1, 'user_follows');
        expect(from).toHaveBeenNthCalledWith(2, 'dives');
        expect(from).toHaveBeenNthCalledWith(3, 'dive_likes');
        // フォロー集合で絞り、公開のみ
        expect(builders[1]?.in).toHaveBeenCalledWith('user_id', [TARGET_ID]);
        expect(builders[1]?.eq).toHaveBeenCalledWith('is_public', true);
        // dive_date desc, id desc のキーセット順
        expect(builders[1]?.order).toHaveBeenNthCalledWith(1, 'dive_date', { ascending: false });
        expect(builders[1]?.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
        // いいねは表示対象の dive ID 群でバッチ取得（N+1 にしない）
        expect(builders[2]?.in).toHaveBeenCalledWith('dive_id', ['d1']);
        expect(page.items).toEqual([
            {
                diveId: 'd1',
                diveDate: '2026-06-10',
                location: '大瀬崎',
                maxDepthM: 18.5,
                bottomTimeMin: 45,
                ownerId: TARGET_ID,
                ownerNickname: 'はなこ',
                ownerHandle: 'hanako',
                likeCount: 2,
                likedByMe: true,
            },
        ]);
        expect(page.nextCursor).toBeNull();
    });

    it('いいねが 1 件も無いログは likeCount=0 / likedByMe=false になる', async () => {
        buildClient({
            fromResults: [
                { data: [{ followee_id: TARGET_ID }], error: null },
                {
                    data: [
                        {
                            id: 'd1',
                            user_id: TARGET_ID,
                            dive_date: '2026-06-10',
                            location: '大瀬崎',
                            max_depth_m: 10,
                            bottom_time_min: 30,
                        },
                    ],
                    error: null,
                },
                { data: [], error: null },
            ],
            rpcResult: { data: [{ user_id: TARGET_ID, nickname: 'はなこ', handle: 'hanako' }], error: null },
        });

        const page = await fetchTimeline();

        expect(page.items[0]).toMatchObject({ likeCount: 0, likedByMe: false });
    });

    it('limit+1 件取れたら (dive_date, id) カーソルを返す', async () => {
        const divesRows = [
            {
                id: 'd3',
                user_id: TARGET_ID,
                dive_date: '2026-06-10',
                location: 'A',
                max_depth_m: 10,
                bottom_time_min: 30,
            },
            {
                id: 'd2',
                user_id: TARGET_ID,
                dive_date: '2026-06-09',
                location: 'B',
                max_depth_m: 10,
                bottom_time_min: 30,
            },
            {
                id: 'd1',
                user_id: TARGET_ID,
                dive_date: '2026-06-08',
                location: 'C',
                max_depth_m: 10,
                bottom_time_min: 30,
            },
        ];
        buildClient({
            fromResults: [
                { data: [{ followee_id: TARGET_ID }], error: null },
                { data: divesRows, error: null },
            ],
            rpcResult: { data: [{ user_id: TARGET_ID, nickname: 'はなこ', handle: 'hanako' }], error: null },
        });

        const page = await fetchTimeline({ limit: 2 });

        expect(page.items).toHaveLength(2);
        expect(page.nextCursor).toEqual({ diveDate: '2026-06-09', id: 'd2' });
    });
});

describe('fetchLikedDives', () => {
    const likedRow = (diveId: string, likedAt: string) => ({
        created_at: likedAt,
        dive_id: diveId,
        dives: {
            id: diveId,
            user_id: TARGET_ID,
            dive_date: '2026-06-10',
            location: '大瀬崎',
            max_depth_m: 18.5,
            bottom_time_min: 45,
        },
    });

    it('未ログインなら空ページを返す', async () => {
        const { from } = buildClient({ user: null });

        const page = await fetchLikedDives();

        expect(page).toEqual({ items: [], nextCursor: null });
        expect(from).not.toHaveBeenCalled();
    });

    it('自分のいいねを新しい順で取得し、いいね情報付きの TimelineItem に整形する', async () => {
        const { from, builders } = buildClient({
            fromResults: [
                // 1: dive_likes（dives を inner join で embed）
                { data: [likedRow('d1', '2026-07-01T10:00:00Z')], error: null },
                // 2: dive_likes（件数集計のバッチ）
                {
                    data: [
                        { dive_id: 'd1', user_id: VIEWER_ID },
                        { dive_id: 'd1', user_id: TARGET_ID },
                    ],
                    error: null,
                },
            ],
            rpcResult: { data: [{ user_id: TARGET_ID, nickname: 'はなこ', handle: 'hanako' }], error: null },
        });

        const page = await fetchLikedDives();

        expect(from).toHaveBeenNthCalledWith(1, 'dive_likes');
        // 本人のいいねのみ・いいね日時の新しい順（keyset）
        expect(builders[0]?.eq).toHaveBeenCalledWith('user_id', VIEWER_ID);
        expect(builders[0]?.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
        expect(builders[0]?.order).toHaveBeenNthCalledWith(2, 'dive_id', { ascending: false });
        expect(page.items).toEqual([
            {
                diveId: 'd1',
                diveDate: '2026-06-10',
                location: '大瀬崎',
                maxDepthM: 18.5,
                bottomTimeMin: 45,
                ownerId: TARGET_ID,
                ownerNickname: 'はなこ',
                ownerHandle: 'hanako',
                likeCount: 2,
                likedByMe: true,
            },
        ]);
        expect(page.nextCursor).toBeNull();
    });

    it('limit+1 件取れたら (likedAt, diveId) カーソルを返す', async () => {
        buildClient({
            fromResults: [
                {
                    data: [
                        likedRow('d3', '2026-07-03T00:00:00Z'),
                        likedRow('d2', '2026-07-02T00:00:00Z'),
                        likedRow('d1', '2026-07-01T00:00:00Z'),
                    ],
                    error: null,
                },
                { data: [], error: null },
            ],
            rpcResult: { data: [{ user_id: TARGET_ID, nickname: 'はなこ', handle: 'hanako' }], error: null },
        });

        const page = await fetchLikedDives({ limit: 2 });

        expect(page.items).toHaveLength(2);
        expect(page.nextCursor).toEqual({ likedAt: '2026-07-02T00:00:00Z', diveId: 'd2' });
    });

    it('いいねが 1 件も無ければ空ページを返す', async () => {
        buildClient({ fromResults: [{ data: [], error: null }] });

        const page = await fetchLikedDives();

        expect(page).toEqual({ items: [], nextCursor: null });
    });

    it('取得エラー時は throw する', async () => {
        buildClient({ fromResults: [{ data: null, error: { message: 'boom' } }] });

        await expect(fetchLikedDives()).rejects.toThrow(/boom/);
    });
});

describe('fetchDiveLikeState', () => {
    it('件数と閲覧者のいいね済み状態を返す', async () => {
        // 1: 件数 count, 2: 閲覧者の行 count
        const { from } = buildClient({ fromResults: [{ count: 3 }, { count: 1 }] });

        const state = await fetchDiveLikeState('d1');

        expect(from).toHaveBeenCalledWith('dive_likes');
        expect(state).toEqual({ likeCount: 3, likedByMe: true });
    });

    it('いいねが無ければ 0 件・未いいね', async () => {
        buildClient({ fromResults: [{ count: 0 }, { count: 0 }] });

        const state = await fetchDiveLikeState('d1');

        expect(state).toEqual({ likeCount: 0, likedByMe: false });
    });

    it('未ログインでも件数は返し likedByMe=false（判定クエリは走らない）', async () => {
        const { from } = buildClient({ user: null, fromResults: [{ count: 5 }] });

        const state = await fetchDiveLikeState('d1');

        expect(state).toEqual({ likeCount: 5, likedByMe: false });
        expect(from).toHaveBeenCalledTimes(1);
    });

    it('件数取得エラー時は throw する', async () => {
        buildClient({ fromResults: [{ error: { message: 'boom' } }, { count: 0 }] });

        await expect(fetchDiveLikeState('d1')).rejects.toThrow(/boom/);
    });
});

describe('searchUsers', () => {
    it('空クエリは即空配列（rpc も from も呼ばない）', async () => {
        const { rpc, from } = buildClient({});

        const result = await searchUsers('   ');

        expect(result).toEqual([]);
        expect(rpc).not.toHaveBeenCalled();
        expect(from).not.toHaveBeenCalled();
    });

    it('ユーザー ID（handle）部分一致の結果に閲覧者のフォロー状態を付与して返す', async () => {
        const { rpc, from, builders } = buildClient({
            // rpc = search_users_by_handle の結果, from = 閲覧者のフォロー集合
            rpcResult: {
                data: [
                    { user_id: 'u1', nickname: 'たろう', handle: 'taro' },
                    { user_id: 'u2', nickname: 'たけし', handle: 'takeshi' },
                ],
                error: null,
            },
            fromResults: [{ data: [{ followee_id: 'u2' }], error: null }],
        });

        const result = await searchUsers('  ta  ');

        // trim して DB 関数へ渡す
        expect(rpc).toHaveBeenCalledWith('search_users_by_handle', { p_query: 'ta' });
        // フォロー判定は結果 id で user_follows を引く
        expect(from).toHaveBeenCalledWith('user_follows');
        expect(builders[0]?.in).toHaveBeenCalledWith('followee_id', ['u1', 'u2']);
        expect(result).toEqual([
            { userId: 'u1', nickname: 'たろう', handle: 'taro', isFollowing: false },
            { userId: 'u2', nickname: 'たけし', handle: 'takeshi', isFollowing: true },
        ]);
    });

    it('rpc エラー時は throw する', async () => {
        buildClient({ rpcResult: { data: null, error: { message: 'boom' } } });

        await expect(searchUsers('た')).rejects.toThrow(/boom/);
    });
});
