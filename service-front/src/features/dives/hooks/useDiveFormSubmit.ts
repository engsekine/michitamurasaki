'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { NO_CREDIT_ACTION_CODE } from '@/features/credits/constants';
import { uploadDivePhotos } from '@/features/dives/lib/uploadDivePhotos';
import type { DiveFormValues } from '@/features/dives/schemas/dive.schema';
import { createDive, createDiveFromPlan, updateDive } from '@/features/dives/server/actions';
import { deleteDivePhoto } from '@/features/dives/server/photoActions';
import { createClient } from '@/shared/lib/supabase/browser';

interface UseDiveFormSubmitResult {
    isPending: boolean;
    serverError: string | null;
    /** ログ本体は保存できたが、同行バディの同期など一部処理に失敗したときの警告 */
    serverWarning: string | null;
    /** ログ枠不足で作成が拒否された（026 / FR-002）。フォームは NoCreditBanner を表示する */
    noCredit: boolean;
    /**
     * react-hook-form の handleSubmit に渡すサブミットハンドラ。
     * - 新規作成時: photos に File[] を渡すと、ログ保存 → dive_id 確定 → アップロードの順で同時添付する。
     * - 編集時: photoIdsToDelete に削除予定の写真 ID を渡すと、更新成功後にまとめて削除する（保存時削除）。
     */
    submit: (values: DiveFormValues, photos?: File[], photoIdsToDelete?: string[]) => void;
}

/**
 * DiveForm の送信処理を担うフック。
 * diveId が渡されたら更新（updateDive）として動作する。
 * 新規作成では、fromPlanId があれば予定→ログ移動（createDiveFromPlan）、無ければ通常作成（createDive）。
 * 成功時は詳細ページへ遷移し router.refresh() でサーバーコンポーネント側のキャッシュを破棄する。
 */
export const useDiveFormSubmit = (diveId?: string, fromPlanId?: string): UseDiveFormSubmitResult => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);
    const [serverWarning, setServerWarning] = useState<string | null>(null);
    const [noCredit, setNoCredit] = useState(false);

    const isEdit = diveId !== undefined;

    const submit = (values: DiveFormValues, photos?: File[], photoIdsToDelete?: string[]): void => {
        setServerError(null);
        setServerWarning(null);
        setNoCredit(false);
        startTransition(async () => {
            if (isEdit) {
                const result = await updateDive(diveId, values);
                if (!result.success) {
                    setServerError(result.error);
                    return;
                }
                // 保存時に「削除予定」とマークされた写真をまとめて削除する（FR-013）。
                // 部分失敗はログ更新を巻き戻さない（FR-015）。
                if (photoIdsToDelete && photoIdsToDelete.length > 0) {
                    await Promise.all(photoIdsToDelete.map((photoId) => deleteDivePhoto(photoId)));
                }
                // バディ同期が一部失敗した場合は、保存自体は成功しているため遷移せず警告のみ表示する。
                if (result.buddyWarning) {
                    setServerWarning(result.buddyWarning);
                    router.refresh();
                    return;
                }
                router.push(`/dives/${diveId}`);
                router.refresh();
                return;
            }

            // 予定→ログ移動（024）なら createDiveFromPlan、通常作成なら createDive。
            const result = fromPlanId ? await createDiveFromPlan(fromPlanId, values) : await createDive(values);
            if (!result.success) {
                // ログ枠不足（026）はエラー文言ではなく NoCreditBanner で案内する（入力値は保持される）
                if (result.code === NO_CREDIT_ACTION_CODE) {
                    setNoCredit(true);
                    return;
                }
                setServerError(result.error);
                return;
            }

            // ログ保存後に dive_id が確定するので、その配下へ写真をアップロードする（FR-001 AC2）。
            // 写真の部分失敗はログ作成自体を巻き戻さない（FR-015）— 詳細ページで成功分を確認できる。
            if (photos && photos.length > 0) {
                const {
                    data: { user },
                } = await createClient().auth.getUser();
                if (user) await uploadDivePhotos(result.id, user.id, photos);
            }

            // バディ同期が一部失敗しても本体は作成済みなので詳細へ遷移する（警告はログのみ）。
            if (result.buddyWarning) console.warn('[useDiveFormSubmit]', result.buddyWarning);

            // 予定→ログ移動でログは作成できたが予定削除に失敗した場合（024 FR-011a）。
            // serverWarning はフォームのアンマウントで失われるため、遷移先のログ詳細ページで通知する。
            const planDeleteFailed = 'planDeleteFailed' in result && result.planDeleteFailed === true;
            router.push(planDeleteFailed ? `/dives/${result.id}?planDeleteFailed=1` : `/dives/${result.id}`);
            router.refresh();
        });
    };

    return { isPending, serverError, serverWarning, noCredit, submit };
};
