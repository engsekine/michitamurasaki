import { describe, expect, it } from 'vitest';

import { type BuddyRowInput, mapDiveBuddies, mapDiveBuddy } from './buddy-mapper';

describe('mapDiveBuddy', () => {
    it('登録ユーザーのバディは nickname を表示名にし、プロフィール遷移可能になる', () => {
        const row: BuddyRowInput = {
            id: 'b1',
            buddyUserId: 'u1',
            buddyName: null,
            nickname: 'たろう',
            handle: 'taro',
        };
        expect(mapDiveBuddy(row)).toEqual({
            id: 'b1',
            userId: 'u1',
            name: 'たろう',
            handle: 'taro',
            isRegistered: true,
        });
    });

    it('フリーテキストのバディは buddy_name を表示名にし、登録ユーザー扱いにしない', () => {
        const row: BuddyRowInput = {
            id: 'b2',
            buddyUserId: null,
            buddyName: '海太郎',
            nickname: null,
            handle: null,
        };
        expect(mapDiveBuddy(row)).toEqual({
            id: 'b2',
            userId: null,
            name: '海太郎',
            handle: null,
            isRegistered: false,
        });
    });

    it('登録ユーザーだが nickname 未解決のときはフォールバック名を返す', () => {
        const row: BuddyRowInput = {
            id: 'b3',
            buddyUserId: 'u3',
            buddyName: null,
            nickname: null,
            handle: null,
        };
        const result = mapDiveBuddy(row);
        expect(result.isRegistered).toBe(true);
        expect(result.userId).toBe('u3');
        expect(result.name).toBe('（不明なユーザー）');
    });
});

describe('mapDiveBuddies', () => {
    it('複数行を順序を保って変換する', () => {
        const rows: BuddyRowInput[] = [
            { id: 'b1', buddyUserId: 'u1', buddyName: null, nickname: 'A', handle: 'a' },
            { id: 'b2', buddyUserId: null, buddyName: 'B', nickname: null, handle: null },
        ];
        const result = mapDiveBuddies(rows);
        expect(result.map((b) => b.name)).toEqual(['A', 'B']);
        expect(result.map((b) => b.isRegistered)).toEqual([true, false]);
    });
});
