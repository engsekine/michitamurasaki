// @vitest-environment node
import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';

import {
    applyNoIndexHeader,
    type BasicAuthCredentials,
    isNonProductionVercelEnv,
    readBasicAuthCredentials,
    requireBasicAuth,
} from './previewProtection';

const CREDENTIALS: BasicAuthCredentials = { user: 'stg', password: 'p@ss:word' };

/** ブラウザが送る形式（`ID:パスワード` を UTF-8 で Base64 化）の Authorization ヘッダーを組む */
const basicHeader = (user: string, password: string): string =>
    `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;

const requestTo = (path: string, authorization?: string): NextRequest =>
    new NextRequest(new URL(path, 'https://stg.example.com'), authorization ? { headers: { authorization } } : {});

describe('readBasicAuthCredentials', () => {
    it('ID とパスワードが両方あれば資格情報を返す', () => {
        expect(readBasicAuthCredentials({ BASIC_AUTH_USER: 'stg', BASIC_AUTH_PASSWORD: 'secret' })).toEqual({
            user: 'stg',
            password: 'secret',
        });
    });

    it('どちらか一方でも無ければ null（Basic 認証は無効）', () => {
        expect(readBasicAuthCredentials({})).toBeNull();
        expect(readBasicAuthCredentials({ BASIC_AUTH_USER: 'stg' })).toBeNull();
        expect(readBasicAuthCredentials({ BASIC_AUTH_PASSWORD: 'secret' })).toBeNull();
    });

    it('空文字は未設定として扱う', () => {
        expect(readBasicAuthCredentials({ BASIC_AUTH_USER: '', BASIC_AUTH_PASSWORD: 'secret' })).toBeNull();
        expect(readBasicAuthCredentials({ BASIC_AUTH_USER: 'stg', BASIC_AUTH_PASSWORD: '' })).toBeNull();
    });
});

describe('requireBasicAuth', () => {
    it('資格情報が未設定（prod・ローカル）なら Authorization が無くても通過する', () => {
        expect(requireBasicAuth(requestTo('/'), null)).toBeNull();
    });

    it('Authorization ヘッダーが無ければ 401 と WWW-Authenticate を返す', () => {
        const response = requireBasicAuth(requestTo('/'), CREDENTIALS);

        expect(response).toBeInstanceOf(NextResponse);
        expect(response?.status).toBe(401);
        expect(response?.headers.get('www-authenticate')).toMatch(/^Basic realm=/);
    });

    it('ID またはパスワードが違えば 401 を返す', () => {
        expect(requireBasicAuth(requestTo('/', basicHeader('stg', 'wrong')), CREDENTIALS)?.status).toBe(401);
        expect(requireBasicAuth(requestTo('/', basicHeader('other', 'p@ss:word')), CREDENTIALS)?.status).toBe(401);
    });

    it('Basic 以外の認証方式は 401 を返す', () => {
        expect(requireBasicAuth(requestTo('/', 'Bearer token'), CREDENTIALS)?.status).toBe(401);
    });

    it('ID とパスワードが一致すれば通過する（パスワードにコロンを含んでも良い）', () => {
        expect(requireBasicAuth(requestTo('/', basicHeader('stg', 'p@ss:word')), CREDENTIALS)).toBeNull();
    });

    it('マルチバイト文字のパスワードでも UTF-8 として照合する', () => {
        const credentials: BasicAuthCredentials = { user: 'stg', password: 'ひみつ' };

        expect(requireBasicAuth(requestTo('/', basicHeader('stg', 'ひみつ')), credentials)).toBeNull();
    });

    it('除外パス（プレフィックス一致）は Authorization が無くても通過する', () => {
        const excluded = ['/api/health'];

        expect(requireBasicAuth(requestTo('/api/health'), CREDENTIALS, excluded)).toBeNull();
        expect(requireBasicAuth(requestTo('/api/health/'), CREDENTIALS, excluded)).toBeNull();
        expect(requireBasicAuth(requestTo('/api'), CREDENTIALS, excluded)?.status).toBe(401);
    });
});

describe('isNonProductionVercelEnv', () => {
    it('VERCEL_ENV が未定義（ローカル）なら false', () => {
        expect(isNonProductionVercelEnv({})).toBe(false);
    });

    it('production なら false', () => {
        expect(isNonProductionVercelEnv({ VERCEL_ENV: 'production' })).toBe(false);
    });

    it('preview / development なら true', () => {
        expect(isNonProductionVercelEnv({ VERCEL_ENV: 'preview' })).toBe(true);
        expect(isNonProductionVercelEnv({ VERCEL_ENV: 'development' })).toBe(true);
    });
});

describe('applyNoIndexHeader', () => {
    it('X-Robots-Tag に noindex, nofollow を付ける', () => {
        const response = applyNoIndexHeader(NextResponse.next());

        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    });

    it('渡したレスポンスをそのまま返す（Cookie 等の既存ヘッダーを保つ）', () => {
        const original = NextResponse.next();
        original.headers.set('x-existing', 'kept');

        const response = applyNoIndexHeader(original);

        expect(response).toBe(original);
        expect(response.headers.get('x-existing')).toBe('kept');
    });
});
