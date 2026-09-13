'use server';

import { revalidatePath } from 'next/cache';

import { parseSpecialtyTags } from '@/features/certifications/lib/specialtyTags';
import {
    type CertificationFormValues,
    certificationSchema,
} from '@/features/certifications/schemas/certification.schema';
import { requireUser } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';
import { type ValidationResult, validateWithSchema } from '@/shared/lib/validation';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

/** PostgreSQL の一意制約違反（重複登録） */
const UNIQUE_VIOLATION = '23505';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** CertificationFormValues を DB の snake_case にマッピング（タグは子テーブルのため含まない） */
const toDbRow = (input: CertificationFormValues) => ({
    agency: input.agency,
    rank: input.rank,
    acquired_on: input.acquiredOn,
    diver_number: input.diverNumber,
    instructor_number: input.instructorNumber,
    trained_by: input.trainedBy,
    acquired_location: input.acquiredLocation,
    dive_id: input.diveId,
});

/**
 * 入力検証: yup スキーマ（必須・文字数・未来日付）→ 生年月日以降チェックの順に行う。
 * 生年月日（user_details.birth_on）が取得できない場合はチェックをスキップせず拒否する（防御的挙動）。
 * 成功時は trim・null 変換済みの値を返し、DB 書き込みにはこの値を使う。
 */
const validateCertificationInput = async (
    supabase: SupabaseServerClient,
    userId: string,
    input: CertificationFormValues,
): Promise<ValidationResult<CertificationFormValues>> => {
    const validated = await validateWithSchema(certificationSchema, input);
    if (validated.error !== undefined) return validated;
    const values = validated.values;

    const { data, error } = await supabase.from('user_details').select('birth_on').eq('user_id', userId).single();

    if (error || !data) {
        console.error('[validateCertificationInput] failed to fetch user_details:', error);
        return { error: '生年月日が確認できないため登録できません。時間をおいて再度お試しください' };
    }

    if (values.acquiredOn < data.birth_on) {
        return { error: '取得日には生年月日以降の日付を入力してください' };
    }

    // 取得ダイブの所有者確認。FK 制約はログの存在しか保証しない。
    // RLS は公開ログ（他人の is_public ログ）も可視にするため RLS スコープの select だけでは
    // 不十分で、user_id の明示条件で「本人のログ」であることを検証する（021 以降の前提）
    if (values.diveId !== null) {
        const { data: dive, error: diveError } = await supabase
            .from('dives')
            .select('id')
            .eq('id', values.diveId)
            .eq('user_id', userId)
            .maybeSingle();

        if (diveError) {
            console.error('[validateCertificationInput] failed to fetch dive:', diveError);
            return { error: '選択したダイブログの確認に失敗しました。時間をおいて再度お試しください' };
        }
        if (!dive) {
            return { error: '選択したダイブログが見つかりません。再度選択してください' };
        }
    }

    return { values };
};

/** スペシャリティタグを挿入する。成功時は null、失敗時はエラーメッセージを返す */
const insertTags = async (
    supabase: SupabaseServerClient,
    certificationId: string,
    tags: string[],
): Promise<string | null> => {
    if (tags.length === 0) return null;

    const { error } = await supabase
        .from('certification_tags')
        .insert(tags.map((tag) => ({ certification_id: certificationId, tag })));

    if (error) {
        console.error('[insertTags] supabase error:', error);
        return 'スペシャリティタグの保存に失敗しました。編集画面から再度お試しください';
    }

    return null;
};

/** 保有資格を登録する（FR-001, FR-004, FR-008, FR-011, FR-012） */
export const createCertification = async (input: CertificationFormValues): Promise<ActionResult<{ id: string }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const validation = await validateCertificationInput(supabase, user.id, input);
    if (validation.error !== undefined) return actionFailure(validation.error);

    const { data, error } = await supabase
        .from('certifications')
        .insert({ ...toDbRow(validation.values), user_id: user.id })
        .select('id')
        .single();

    if (error || !data) {
        if (error?.code === UNIQUE_VIOLATION) {
            return actionFailure('同じ団体・ランクの資格がすでに登録されています');
        }
        console.error('[createCertification] supabase error:', error);
        return actionFailure('資格の登録に失敗しました。時間をおいて再度お試しください');
    }

    const tagsError = await insertTags(supabase, data.id, parseSpecialtyTags(validation.values.specialtyTags));
    if (tagsError) return actionFailure(tagsError);

    revalidatePath('/settings/certifications');
    return actionSuccess({ id: data.id });
};

/** 保有資格を更新する。タグは削除 + 再挿入で置き換える（FR-007。所有者確認は RLS による） */
export const updateCertification = async (id: string, input: CertificationFormValues): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const validation = await validateCertificationInput(supabase, user.id, input);
    if (validation.error !== undefined) return actionFailure(validation.error);

    const { error } = await supabase.from('certifications').update(toDbRow(validation.values)).eq('id', id);

    if (error) {
        if (error.code === UNIQUE_VIOLATION) {
            return actionFailure('同じ団体・ランクの資格がすでに登録されています');
        }
        console.error('[updateCertification] supabase error:', error);
        return actionFailure('資格の更新に失敗しました。時間をおいて再度お試しください');
    }

    const { error: tagsDeleteError } = await supabase.from('certification_tags').delete().eq('certification_id', id);

    if (tagsDeleteError) {
        console.error('[updateCertification] tags delete error:', tagsDeleteError);
        return actionFailure('スペシャリティタグの更新に失敗しました。時間をおいて再度お試しください');
    }

    const tagsError = await insertTags(supabase, id, parseSpecialtyTags(validation.values.specialtyTags));
    if (tagsError) return actionFailure(tagsError);

    revalidatePath('/settings/certifications');
    return actionSuccess();
};

/** 保有資格を削除する。タグは on delete cascade で同時に消える（FR-007。所有者確認は RLS による） */
export const deleteCertification = async (id: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase.from('certifications').delete().eq('id', id);

    if (error) {
        console.error('[deleteCertification] supabase error:', error);
        return actionFailure('資格の削除に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePath('/settings/certifications');
    return actionSuccess();
};
