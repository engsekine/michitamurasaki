import { notFound } from 'next/navigation';
import { listDiveSites, siteLabel } from '@/features/dive-sites';
import {
    DiveForm,
    diveLocationLabel,
    getDive,
    getDiveBuddies,
    getDivePhotos,
    mapDiveToFormValues,
} from '@/features/dives';
import { getShopOptions } from '@/features/shops';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';
import { createClient } from '@/shared/lib/supabase/server';

interface EditDivePageProps {
    params: Promise<{ id: string }>;
}

export const generateMetadata = async ({ params }: EditDivePageProps) => {
    const { id } = await params;
    return generatePageMetadata(
        {
            slug: `/dives/${id}/edit`,
            title: 'ダイビングログ編集',
            description: 'ダイビングログを編集します',
        },
        { noIndex: true },
    );
};

export default async function EditDivePage({ params }: EditDivePageProps) {
    const { id } = await params;
    // ショップ選択肢は page 合成で注入する（feature 間 import 禁止 / 033 research.md Decision 5）
    const [dive, sites, shopOptions] = await Promise.all([getDive(id), listDiveSites(), getShopOptions()]);
    if (!dive) notFound();

    // getDive は公開ログ（他人のログ）も返すため、編集は作成者本人に限定する。
    // 他人の公開ログの編集 URL を直接開いても 404 にする（更新は RLS でも弾かれる二重防御）。
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (dive.userId !== user?.id) notFound();

    const [photos, buddies] = await Promise.all([
        getDivePhotos(id, `${dive.diveDate} ${diveLocationLabel(dive)} の写真`),
        getDiveBuddies(id),
    ]);
    // 既存バディをフォーム値へ（登録ユーザーは userId、フリーテキストは name）。
    // 編集時に preload しないと保存時の差分同期で全削除されてしまうため必須。
    const buddyValues = buddies.map((buddy) =>
        buddy.isRegistered && buddy.userId ? { userId: buddy.userId, nickname: buddy.name } : { name: buddy.name },
    );
    const defaultValues = { ...mapDiveToFormValues(dive), buddies: buddyValues };
    const siteOptions = sites.map((site) => ({ value: site.id, label: siteLabel(site) }));

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs
                breadcrumbs={[
                    { name: 'ダイビングログ', slug: '/dives' },
                    { name: diveLocationLabel(dive), slug: `/dives/${id}` },
                    { name: '編集' },
                ]}
            />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>ダイビングログ編集</Heading>
                <DiveForm
                    diveId={id}
                    defaultValues={defaultValues}
                    siteOptions={siteOptions}
                    existingPhotos={photos}
                    shopOptions={shopOptions}
                />
            </div>
        </div>
    );
}
