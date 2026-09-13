import { redirect } from 'next/navigation';

import { ProfileCompletionForm } from '@/features/auth/components/client/ProfileCompletionForm';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';
import { createClient } from '@/shared/lib/supabase/server';

export const metadata = generatePageMetadata(
    {
        slug: '/profile-completion',
        title: 'プロフィール登録',
        description: 'ご利用の前にプロフィールを登録してください',
    },
    { noIndex: true },
);

export default async function ProfileCompletionPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    /** 補完済み（user_details 行あり）なら本ページは不要なので TOP へ戻す */
    const { data: details } = await supabase
        .from('user_details')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
    if (details) redirect('/');

    return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
            <div className="flex flex-col gap-2">
                <Heading level={1}>プロフィール登録</Heading>
                <p className="text-muted-foreground text-sm">
                    ダイビングログを始める前に、プロフィールを登録してください。
                </p>
            </div>
            <ProfileCompletionForm />
        </div>
    );
}
