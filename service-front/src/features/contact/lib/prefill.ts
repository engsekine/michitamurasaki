import type { ContactFormValues } from '../schemas/contact.schema';

/** prefill に使う氏名のもと（user_details の一部） */
export interface PrefillNameSource {
    last_name: string | null;
    first_name: string | null;
}

/**
 * ログイン中ユーザーの氏名・メールからフォーム初期値を組み立てる（US3 / FR-013）。
 * 未ログイン（detail / email が無い）場合は空の初期値を返す。
 */
export const buildContactDefaultValues = (
    detail: PrefillNameSource | null,
    email: string | null,
): ContactFormValues => {
    const name = detail ? `${detail.last_name ?? ''}${detail.first_name ?? ''}`.trim() : '';

    return {
        name,
        email: email ?? '',
        category: '',
        body: '',
        website: '',
    };
};
