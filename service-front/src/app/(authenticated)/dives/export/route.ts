import type { Database } from '@repo/supabase';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

import { diveLocationLabel } from '@/features/dives/lib/diveLabel';
import { divesToCsv } from '@/features/dives/lib/export-csv';
import { buildExportFilename, contentDisposition } from '@/features/dives/lib/export-filename';
import { parseExportParams } from '@/features/dives/lib/export-params';
import { fetchDivesForExport } from '@/features/dives/server/export-query';
import type { Dive } from '@/features/dives/types';
import { getVerifiedAalLevels, isMfaChallengePending } from '@/features/mfa/lib/aalGuard';
import { createClient } from '@/shared/lib/supabase/server';

/** ids が 1 件のときは単一ログ出力としてファイル名にダイブ日・ポイント名を含める */
const singleFilenameInput = (ids: string[] | null, dives: Dive[]) => {
    if (ids?.length !== 1) return undefined;
    const dive = dives[0];
    if (!dive) return undefined;
    return { diveDate: dive.diveDate, label: diveLocationLabel({ location: dive.location, diveSite: dive.diveSite }) };
};

/** Authorization: Bearer <token> を取り出す（無ければ null = cookie 認証にフォールバック） */
const bearerToken = (request: NextRequest): string | null => {
    const header = request.headers.get('authorization');
    if (!header?.toLowerCase().startsWith('bearer ')) return null;
    return header.slice('bearer '.length).trim() || null;
};

/**
 * Bearer トークン用の Supabase クライアント（029 モバイル / anon キー + RLS）。
 * PostgREST へのリクエストにトークンを載せることで RLS が本人として評価される。
 */
const createBearerClient = (token: string) => {
    const url = process.env['SUPABASE_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
    const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';
    return createSupabaseJsClient<Database>(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
};

/**
 * GET /dives/export — ダイブログを CSV / PDF でダウンロードする。
 * 認証必須（RLS により本人のログのみ対象）。契約は specs/014-log-export/contracts/export-endpoint.md。
 * Web は cookie セッション、モバイル（029）は Authorization: Bearer で認証する。
 */
export const GET = async (request: NextRequest): Promise<Response> => {
    const token = bearerToken(request);
    const supabase = token ? createBearerClient(token) : await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser(token ?? undefined);
    if (!user) {
        return new NextResponse('認証が必要です', { status: 401 });
    }

    /**
     * Route Handler は (authenticated)/layout の 2 要素認証ゲートを通らないため、
     * 2 段階目が保留中（AAL1→AAL2）のセッションで全ログをダウンロードできてしまう。
     * layout / requireUser と同じ基準で拒否する（Bearer 経路はトークンを渡して検証する）
     */
    if (isMfaChallengePending(await getVerifiedAalLevels(supabase, { user, jwt: token ?? undefined }))) {
        return new NextResponse('2 段階認証を完了してください', { status: 403 });
    }

    const parsed = parseExportParams(request.nextUrl.searchParams);
    if (!parsed.ok) {
        return new NextResponse(parsed.error, { status: 400 });
    }

    const { format, ids, filter } = parsed;

    try {
        const dives = await fetchDivesForExport(supabase, { ids, filter, ownerId: user.id });
        const filename = buildExportFilename({ format, date: new Date(), single: singleFilenameInput(ids, dives) });

        if (format === 'csv') {
            return new NextResponse(divesToCsv(dives), {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': contentDisposition(filename),
                    'Cache-Control': 'no-store',
                },
            });
        }

        // PDF: 写真サムネイル（WebP→PNG）を集めてログブック体裁で描画する。
        // @react-pdf / sharp は重いため動的 import で CSV 経路に載せない。
        const { fetchExportThumbnails } = await import('@/features/dives/server/export-thumbs');
        const { buildPdfData } = await import('@/features/dives/pdf/build-pdf-data');
        const { renderDiveLogPdf } = await import('@/features/dives/pdf/DiveLogPdf');

        const thumbnails = await fetchExportThumbnails(
            supabase,
            dives.map((dive) => dive.id),
        );
        const pdf = await renderDiveLogPdf(buildPdfData(dives, thumbnails));

        // Node の Buffer ではなく Uint8Array で返す（BodyInit 互換・ランタイム非依存）
        return new NextResponse(new Uint8Array(pdf), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': contentDisposition(filename),
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('[dives/export] エクスポート生成に失敗しました', error);
        return new NextResponse('エクスポートの生成に失敗しました。時間をおいて再度お試しください。', {
            status: 500,
        });
    }
};
