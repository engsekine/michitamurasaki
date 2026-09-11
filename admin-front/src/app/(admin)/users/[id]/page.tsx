import { notFound } from 'next/navigation';

import { requireAdmin } from '@/features/admin-auth';
import { getUserDetail, getUserMfaStatus } from '@/features/users-admin';
import { RemoveMfaButton } from '@/features/users-admin/components/client/RemoveMfaButton';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata({
    slug: '/users',
    title: 'ユーザー詳細',
    description: 'ユーザーの詳細情報',
});

const GENDER_LABEL: Record<string, string> = { male: '男性', female: '女性', unanswered: '未回答' };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    /** 3 つは独立（クエリはそれぞれ requireAdmin を通る）ため並列で取得する */
    const [admin, view, mfaStatus] = await Promise.all([requireAdmin(), getUserDetail(id), getUserMfaStatus(id)]);
    if (!view) notFound();
    /** 2 要素認証の解除は superadmin 限定（Server Action 側でも同じ判定を行う） */
    const canRemoveMfa = admin.role === 'superadmin';

    const { detail, diveCount } = view;

    const rows: { label: string; value: string }[] = [
        { label: 'ニックネーム', value: detail.nickname },
        { label: '氏名', value: `${detail.last_name} ${detail.first_name}` },
        { label: '氏名（ローマ字）', value: `${detail.last_name_romaji} ${detail.first_name_romaji}` },
        { label: '生年月日', value: detail.birth_on },
        { label: '性別', value: GENDER_LABEL[detail.gender] ?? detail.gender },
        { label: 'ダイブログ件数', value: String(diveCount) },
        { label: '登録日', value: new Date(detail.created_at).toLocaleDateString('ja-JP') },
    ];

    return (
        <div className="flex flex-col gap-4">
            <h1 className="font-semibold text-2xl">{detail.nickname}</h1>
            <dl className="grid max-w-xl grid-cols-[12rem_1fr] gap-y-2 text-sm">
                {rows.map((row) => (
                    <div key={row.label} className="contents">
                        <dt className="font-medium text-muted-foreground">{row.label}</dt>
                        <dd>{row.value}</dd>
                    </div>
                ))}
            </dl>

            <section aria-labelledby="mfa-heading" className="flex max-w-xl flex-col gap-2 border-border border-t pt-4">
                <h2 id="mfa-heading" className="font-semibold text-lg">
                    2 要素認証
                </h2>
                {mfaStatus.enabled ? (
                    canRemoveMfa ? (
                        <>
                            <p className="text-muted-foreground text-sm">
                                このユーザーは 2
                                要素認証（電話番号）が有効です。電話紛失時などは下のボタンで解除できます。
                            </p>
                            <RemoveMfaButton userId={detail.user_id} />
                        </>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            このユーザーは 2 要素認証（電話番号）が有効です。解除は上位管理者に依頼してください。
                        </p>
                    )
                ) : (
                    <p className="text-muted-foreground text-sm">このユーザーは 2 要素認証を有効化していません。</p>
                )}
            </section>
        </div>
    );
}
