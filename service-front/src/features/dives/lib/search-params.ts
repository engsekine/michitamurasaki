// サーバー（page.tsx の searchParams）とブラウザ（useSearchParams）の双方から使うため、
// 'use client' / 'server-only' は付けない純粋関数のみ。
import { DIVE_TYPE_OPTIONS } from '@/features/dives/constants';
import type { DiveListFilter } from '@/features/dives/types';

const DIVE_TYPE_VALUES = new Set<string>(DIVE_TYPE_OPTIONS.map((option) => option.value));
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 最大水深フィルタが取りうる範囲（ログの最大水深ドメインに合わせる） */
const DEPTH_MIN = 0;
const DEPTH_MAX = 300;
const DIVE_NUMBER_MAX = 9999;
const LOCATION_MAX_LENGTH = 120;
const BUDDY_NAME_MAX_LENGTH = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 0〜300 の有限数なら返す。範囲外・非数は undefined（パラメータ無視） */
const parseDepth = (raw: string | null): number | undefined => {
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value)) return undefined;
    if (value < DEPTH_MIN || value > DEPTH_MAX) return undefined;
    return value;
};

/** 0〜9999 の整数なら返す。範囲外・非整数は undefined */
const parseDiveNumber = (raw: string | null): number | undefined => {
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > DIVE_NUMBER_MAX) return undefined;
    return value;
};

/** YYYY-MM-DD 形式なら返す。それ以外は undefined */
const parseDate = (raw: string | null): string | undefined => {
    if (raw === null) return undefined;
    return DATE_PATTERN.test(raw) ? raw : undefined;
};

/**
 * URL クエリ → DiveListFilter。不正・範囲外の値はそのパラメータのみ無視する（寛容にパース）。
 * パラメータ契約は contracts/search-params.md を参照。
 */
export const parseDiveFilter = (params: URLSearchParams): DiveListFilter => {
    const filter: DiveListFilter = {};

    const diveNumber = parseDiveNumber(params.get('number'));
    if (diveNumber !== undefined) filter.diveNumber = diveNumber;

    const dateFrom = parseDate(params.get('date_from'));
    if (dateFrom !== undefined) filter.dateFrom = dateFrom;

    const dateTo = parseDate(params.get('date_to'));
    if (dateTo !== undefined) filter.dateTo = dateTo;

    const depthMin = parseDepth(params.get('depth_min'));
    if (depthMin !== undefined) filter.depthMin = depthMin;

    const depthMax = parseDepth(params.get('depth_max'));
    if (depthMax !== undefined) filter.depthMax = depthMax;

    const diveType = params.get('type');
    if (diveType && DIVE_TYPE_VALUES.has(diveType)) filter.diveType = diveType;

    const location = params.get('q')?.trim();
    if (location) filter.location = location.slice(0, LOCATION_MAX_LENGTH);

    // バディ（登録ユーザー）: uuid 形式のみ採用（spec 021 FR-022）
    const buddy = params.get('buddy')?.trim();
    if (buddy && UUID_PATTERN.test(buddy)) filter.buddyUserId = buddy;

    // バディ名（フリーテキスト・部分一致）
    const buddyName = params.get('buddy_name')?.trim();
    if (buddyName) filter.buddyName = buddyName.slice(0, BUDDY_NAME_MAX_LENGTH);

    return filter;
};

/** DiveListFilter → URLSearchParams。空値は省略する */
export const filterToSearchParams = (filter: DiveListFilter): URLSearchParams => {
    const params = new URLSearchParams();
    if (filter.diveNumber !== undefined) params.set('number', String(filter.diveNumber));
    if (filter.dateFrom) params.set('date_from', filter.dateFrom);
    if (filter.dateTo) params.set('date_to', filter.dateTo);
    if (filter.depthMin !== undefined) params.set('depth_min', String(filter.depthMin));
    if (filter.depthMax !== undefined) params.set('depth_max', String(filter.depthMax));
    if (filter.diveType) params.set('type', filter.diveType);
    if (filter.location) params.set('q', filter.location);
    if (filter.buddyUserId) params.set('buddy', filter.buddyUserId);
    if (filter.buddyName) params.set('buddy_name', filter.buddyName);
    return params;
};

/** Next.js page の searchParams（Record）を URLSearchParams に変換する（配列は先頭を採用） */
export const recordToSearchParams = (record: Record<string, string | string[] | undefined>): URLSearchParams => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(record)) {
        if (value === undefined) continue;
        params.set(key, Array.isArray(value) ? (value[0] ?? '') : value);
    }
    return params;
};

const FILTER_KEYS: (keyof DiveListFilter)[] = [
    'diveNumber',
    'dateFrom',
    'dateTo',
    'depthMin',
    'depthMax',
    'diveType',
    'location',
    'buddyUserId',
    'buddyName',
];

/** 2 つのフィルタが同一条件か（initialData シードや冪等判定に使う） */
export const isSameFilter = (a: DiveListFilter, b: DiveListFilter): boolean =>
    FILTER_KEYS.every((key) => a[key] === b[key]);
