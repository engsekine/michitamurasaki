'use server';

import { revalidatePath } from 'next/cache';

import { processPhoto } from '@/features/dives/lib/imageProcessing';
import { buildDisplayPath, buildThumbPath, DIVE_PHOTOS_BUCKET } from '@/features/dives/lib/photoStorage';
import { MAX_PHOTOS_PER_DIVE } from '@/features/dives/lib/photoValidation';
import { photoCaptionSchema } from '@/features/dives/schemas/photo.schema';
import { requireUser } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';
import { validateWithSchema } from '@/shared/lib/validation';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

interface AddDivePhotoInput {
    diveId: string;
    /** クライアントが Storage に直アップロードした原本のパス（{user_id}/{dive_id}/orig/...） */
    origPath: string;
    caption?: string;
}

/**
 * クライアントが上げた原本を処理し、表示用 / サムネイルを生成して dive_photos に登録する（FR-001 / FR-009 / FR-016 / FR-017）。
 * 所有権・枚数・形式はサーバーで再検証する（クライアント検証は信頼しない）。
 */
export const addDivePhoto = async (input: AddDivePhotoInput): Promise<ActionResult<{ photoId: string }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    // 型不一致の payload（Server Action 直叩き）で後段が TypeError → 500 にならないよう形式を先に確認する
    if (typeof input.diveId !== 'string' || typeof input.origPath !== 'string') {
        return actionFailure('不正なリクエストです');
    }

    // 所有権: 対象 dive が本人のものか（情報漏洩を避け、無い場合は一般文言）
    const { data: dive } = await supabase
        .from('dives')
        .select('id')
        .eq('id', input.diveId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (!dive) return actionFailure('対象のログが見つかりません');

    // 原本パスが本人 / 対象 dive 配下か（パスインジェクション防止）
    if (!input.origPath.startsWith(`${user.id}/${input.diveId}/`)) {
        return actionFailure('不正な画像パスです');
    }

    // キャプションはスキーマで再検証する（長さ・型。クライアント検証は信頼しない）
    const captionValidated = await validateWithSchema(photoCaptionSchema, { caption: input.caption ?? '' });
    if (captionValidated.error !== undefined) return actionFailure(captionValidated.error);

    // 枚数上限（既存 + 1 枚）。FR-003
    const { count } = await supabase
        .from('dive_photos')
        .select('id', { count: 'exact', head: true })
        .eq('dive_id', input.diveId);
    const existingCount = count ?? 0;
    if (existingCount >= MAX_PHOTOS_PER_DIVE) {
        return actionFailure(`写真は 1 ログにつき最大 ${MAX_PHOTOS_PER_DIVE} 枚までです`);
    }

    // 原本を取得
    const { data: blob, error: downloadError } = await supabase.storage
        .from(DIVE_PHOTOS_BUCKET)
        .download(input.origPath);
    if (downloadError || !blob) {
        console.error('[addDivePhoto] download error:', downloadError);
        return actionFailure('画像の取得に失敗しました。時間をおいて再度お試しください');
    }

    // 回転適用・全メタ除去・WebP 変換・サムネイル生成
    let processed: Awaited<ReturnType<typeof processPhoto>>;
    try {
        processed = await processPhoto(Buffer.from(await blob.arrayBuffer()));
    } catch (error) {
        console.error('[addDivePhoto] process error:', error);
        await supabase.storage.from(DIVE_PHOTOS_BUCKET).remove([input.origPath]);
        return actionFailure('対応していない画像形式です');
    }

    const photoId = crypto.randomUUID();
    const displayPath = buildDisplayPath(user.id, input.diveId, photoId);
    const thumbPath = buildThumbPath(user.id, input.diveId, photoId);

    const [displayUpload, thumbUpload] = await Promise.all([
        supabase.storage
            .from(DIVE_PHOTOS_BUCKET)
            .upload(displayPath, processed.display, { contentType: 'image/webp', upsert: true }),
        supabase.storage
            .from(DIVE_PHOTOS_BUCKET)
            .upload(thumbPath, processed.thumb, { contentType: 'image/webp', upsert: true }),
    ]);
    if (displayUpload.error || thumbUpload.error) {
        console.error('[addDivePhoto] upload error:', displayUpload.error ?? thumbUpload.error);
        await supabase.storage.from(DIVE_PHOTOS_BUCKET).remove([displayPath, thumbPath]);
        return actionFailure('画像の保存に失敗しました。時間をおいて再度お試しください');
    }

    // 原本は処理後に削除（公開対象外・多層防御。失敗しても致命的ではない）
    await supabase.storage.from(DIVE_PHOTOS_BUCKET).remove([input.origPath]);

    const { data: inserted, error: insertError } = await supabase
        .from('dive_photos')
        .insert({
            id: photoId,
            dive_id: input.diveId,
            user_id: user.id,
            display_path: displayPath,
            thumb_path: thumbPath,
            caption: input.caption?.trim() ?? '',
            sort_order: existingCount,
            is_cover: existingCount === 0,
            width: processed.width,
            height: processed.height,
        })
        .select('id')
        .single();
    if (insertError || !inserted) {
        console.error('[addDivePhoto] insert error:', insertError);
        await supabase.storage.from(DIVE_PHOTOS_BUCKET).remove([displayPath, thumbPath]);
        return actionFailure('画像の登録に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePath(`/dives/${input.diveId}`);
    return actionSuccess({ photoId: inserted.id });
};

/**
 * 写真 1 枚を削除する（FR-013）。Storage オブジェクトとメタ行の両方を消す。
 * 代表写真を消した場合は残りの先頭（最小 sort_order）を代表に昇格する。
 */
export const deleteDivePhoto = async (photoId: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { data: photo } = await supabase
        .from('dive_photos')
        .select('id, dive_id, display_path, thumb_path, is_cover')
        .eq('id', photoId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (!photo) return actionFailure('対象の写真が見つかりません');

    await supabase.storage.from(DIVE_PHOTOS_BUCKET).remove([photo.display_path, photo.thumb_path]);

    const { error: deleteError } = await supabase.from('dive_photos').delete().eq('id', photoId);
    if (deleteError) {
        console.error('[deleteDivePhoto] delete error:', deleteError);
        return actionFailure('写真の削除に失敗しました。時間をおいて再度お試しください');
    }

    // 代表写真を消したら残りの先頭を昇格（Edge Case）
    if (photo.is_cover) {
        const { data: next } = await supabase
            .from('dive_photos')
            .select('id')
            .eq('dive_id', photo.dive_id)
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle();
        if (next) {
            await supabase.from('dive_photos').update({ is_cover: true }).eq('id', next.id);
        }
    }

    revalidatePath(`/dives/${photo.dive_id}`);
    return actionSuccess();
};
