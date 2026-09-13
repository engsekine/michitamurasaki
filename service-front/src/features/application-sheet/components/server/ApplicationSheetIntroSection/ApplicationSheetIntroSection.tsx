import Link from 'next/link';

import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';

import { buildSheetText } from '../../../lib/buildSheetText';
import { toSheetDefaultValues } from '../../../lib/toSheetDefaultValues';
import { applicationSheetSchema } from '../../../schemas/application-sheet.schema';
import { getApplicationSheetPrefill } from '../../../server/queries';

/** プレビューのスクロールボックス（1 行に収めて suppression を効かせるため定数化） */
const PREVIEW_BOX_CLASS = 'max-h-72 overflow-y-auto rounded-lg border border-border bg-muted/30';

/** TOP に載せる機能ポイント（実装と乖離しないよう文言は本セクションで一元管理） */
const FEATURE_POINTS = [
    'プロフィールやログの登録内容から自動入力',
    'ショップごとに名前を付けて複数保存・呼び出し',
    '生成テキストをワンタップでコピーして LINE・メールへ',
] as const;

/**
 * TOP ダッシュボードの申し込みシート導線セクション（032 / FR-001）。
 * 登録内容から実際に生成したテキストのプレビューを添えて、何ができるかを一目で伝える。
 */
export const ApplicationSheetIntroSection = async () => {
    const prefill = await getApplicationSheetPrefill();
    const previewText = buildSheetText({ ...applicationSheetSchema.getDefault(), ...toSheetDefaultValues(prefill) });

    return (
        <section aria-labelledby="dashboard-application-sheet" className="flex flex-col gap-6 pt-20">
            <Heading level={2} id="dashboard-application-sheet">
                申し込みシート
            </Heading>
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
                <div className="flex flex-col items-start gap-4">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        ショップから依頼される「お名前（　）・年齢（　歳）…」のような定型の記入文を、フォーム入力からそのまま送れるテキストとして生成できます。
                    </p>
                    <ul className="flex flex-col gap-2">
                        {FEATURE_POINTS.map((point) => (
                            <li key={point} className="flex items-start gap-2 text-sm">
                                <span aria-hidden="true" className="mt-0.5 shrink-0 text-sky-600">
                                    ✓
                                </span>
                                {point}
                            </li>
                        ))}
                    </ul>
                    <Link href="/application-sheet" className={buttonVariants({ variant: 'default', size: 'lg' })}>
                        申し込みシートを作る
                    </Link>
                </div>
                <figure className="flex flex-col gap-2">
                    <figcaption id="sheet-preview-caption" className="text-muted-foreground text-xs">
                        あなたの登録内容で生成したプレビュー
                    </figcaption>
                    {/* biome-ignore lint/a11y/noNoninteractiveTabindex: スクロール可能領域はキーボードで操作できる必要がある（axe: scrollable-region-focusable） */}
                    <section tabIndex={0} className={PREVIEW_BOX_CLASS} aria-labelledby="sheet-preview-caption">
                        <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed">
                            {previewText}
                        </pre>
                    </section>
                </figure>
            </div>
        </section>
    );
};
