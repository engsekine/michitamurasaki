import { redirect } from 'next/navigation';

import { UpdatePasswordForm } from '@/features/auth';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';
import { createClient } from '@/shared/lib/supabase/server';

export const metadata = generatePageMetadata(
    {
        slug: '/update-password',
        title: '新しいパスワードの設定',
        description: 'リセットリンクから新しいパスワードを設定します',
    },
    { noIndex: true },
);

/**
 * リセットリンク経由の新パスワード設定ページ（001 / US4-3 / FR-019）。
 * リセットメール → /api/auth/callback?next=/update-password でリカバリーセッションが
 * 確立された状態で到達する。セッションが無い直接アクセスはログインへ返す。
 */
export default async function UpdatePasswordPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    return (
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
            <Heading level={1}>新しいパスワードの設定</Heading>
            <p className="text-muted-foreground text-sm">
                新しいパスワードを入力してください。設定後、新しいパスワードでログインし直します。
            </p>
            <UpdatePasswordForm />
        </div>
    );
}
