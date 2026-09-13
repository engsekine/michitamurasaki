import Link from 'next/link';
import {
    ApplicationSheetForm,
    getApplicationSheet,
    getApplicationSheetPrefill,
    listApplicationSheets,
    PAGE_DATA,
    SavedSheetList,
    toSheetDefaultValues,
} from '@/features/application-sheet';
import { getShopOptions } from '@/features/shops';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(PAGE_DATA, { noIndex: true });

interface ApplicationSheetPageProps {
    searchParams: Promise<{ sheet?: string }>;
}

/**
 * 申し込みシート作成ページ（認証必須。未認証は proxy.ts が /login へリダイレクト）。
 * `?sheet=<id>` で保存済みシートを開く。新規作成時はプロフィール等からの自動入力を初期値にする（FR-007/010）。
 */
export default async function ApplicationSheetPage({ searchParams }: ApplicationSheetPageProps) {
    const { sheet: sheetParam } = await searchParams;

    // 宛先ショップの選択肢は page 合成で注入する（feature 間 import 禁止 / 033 research.md Decision 5）
    const [prefill, sheets, selectedSheet, shopOptions] = await Promise.all([
        getApplicationSheetPrefill(),
        listApplicationSheets(),
        sheetParam ? getApplicationSheet(sheetParam) : Promise.resolve(null),
        getShopOptions(),
    ]);

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: '申し込みシート' }]} />
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>申し込みシート</Heading>
                <p className="text-muted-foreground text-sm">
                    ショップから依頼される定型の記入文をフォーム入力から生成できます。未入力の項目は空欄のまま出力されます。
                </p>
                {sheets.length > 0 && (
                    <section className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <Heading level={2}>保存済みシート</Heading>
                            {selectedSheet && (
                                <Link
                                    href="/application-sheet"
                                    className="text-primary text-sm underline underline-offset-4"
                                >
                                    新しいシートを作る
                                </Link>
                            )}
                        </div>
                        <SavedSheetList sheets={sheets} selectedSheetId={selectedSheet?.id ?? null} />
                    </section>
                )}
                <ApplicationSheetForm
                    key={selectedSheet?.id ?? 'new'}
                    defaultValues={selectedSheet ? selectedSheet.values : toSheetDefaultValues(prefill)}
                    sheetId={selectedSheet?.id ?? null}
                    initialSheetName={selectedSheet?.name ?? ''}
                    shopOptions={shopOptions}
                />
            </div>
        </div>
    );
}
