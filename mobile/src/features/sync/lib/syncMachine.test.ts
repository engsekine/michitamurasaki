import { describe, expect, it } from 'vitest';

import { classifyTransferResult, pickNextTransfer } from './syncMachine';

describe('pickNextTransfer（直列キュー / contracts/sync-protocol.md）', () => {
    const row = (id: string, createdAt: string) => ({ id, created_at: createdAt });

    it('作成日時の古い順に 1 件ずつ選ぶ', () => {
        const next = pickNextTransfer([row('b', '2026-07-02T00:00:00Z'), row('a', '2026-07-01T00:00:00Z')]);
        expect(next).toEqual({ type: 'transfer', id: 'a' });
    });

    it('キューが空なら完了', () => {
        expect(pickNextTransfer([])).toEqual({ type: 'done' });
    });
});

describe('classifyTransferResult（結果分類 / FR-005・FR-006）', () => {
    it('エラーなしは成功', () => {
        expect(classifyTransferResult({ thrown: false, errorCode: null, errorMessage: null })).toEqual({
            kind: 'success',
        });
    });

    it('23505（PK 重複）は冪等成功（前回のレスポンス欠落の再送）', () => {
        expect(
            classifyTransferResult({
                thrown: false,
                errorCode: '23505',
                errorMessage: 'duplicate key value violates unique constraint "dives_pkey"',
                errorDetails: 'Key (id)=(0b8f4e2a-1111-4222-8333-444444444444) already exists.',
            }),
        ).toEqual({ kind: 'success' });
    });

    it('23505 でもダイブ番号の重複（dives_user_id_dive_number_key）は rejected（サーバー未保存のため成功扱いにしない）', () => {
        const result = classifyTransferResult({
            thrown: false,
            errorCode: '23505',
            errorMessage: 'duplicate key value violates unique constraint "dives_user_id_dive_number_key"',
            errorDetails: 'Key (user_id, dive_number)=(user-a, 42) already exists.',
        });
        expect(result.kind).toBe('rejected');
        if (result.kind === 'rejected') {
            expect(result.message).toContain('ダイブ番号');
        }
    });

    it('23505 で制約名が判別できない場合も成功扱いにしない（フェイルクローズド）', () => {
        expect(classifyTransferResult({ thrown: false, errorCode: '23505', errorMessage: 'duplicate key' }).kind).toBe(
            'rejected',
        );
    });

    it('通信例外（throw）は retry（pending に戻して次のトリガーを待つ）', () => {
        expect(
            classifyTransferResult({ thrown: true, errorCode: null, errorMessage: 'Network request failed' }),
        ).toEqual({ kind: 'retry' });
    });

    it('42501（RLS 拒否）は rejected として理由を保持する', () => {
        const result = classifyTransferResult({
            thrown: false,
            errorCode: '42501',
            errorMessage: 'new row violates row-level security policy',
        });
        expect(result.kind).toBe('rejected');
        if (result.kind === 'rejected') {
            expect(result.message).toContain('権限');
        }
    });

    it('その他のサーバーエラーは rejected としてメッセージを保持する', () => {
        const result = classifyTransferResult({ thrown: false, errorCode: '23502', errorMessage: 'null value' });
        expect(result.kind).toBe('rejected');
        if (result.kind === 'rejected') {
            expect(result.message).toContain('null value');
        }
    });
});
