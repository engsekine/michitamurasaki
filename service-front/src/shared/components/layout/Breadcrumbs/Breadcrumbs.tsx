import type { Route } from 'next';
import Link from 'next/link';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/shared/components/ui/Breadcrumb';

import { SITE_NAME, SITE_URL } from '@/shared/constants/site';

export interface BreadcrumbEntry {
    /** 遷移先パス。動的セグメント（`/plans/${id}` 等）を含むため Route 型ではなく string で受ける */
    slug?: string;
    name: string;
}

interface BreadcrumbsProps {
    breadcrumbs: BreadcrumbEntry[];
}

/**
 * JSON-LD を `<script>` に埋め込むための安全なシリアライズ。
 *
 * なぜ: `JSON.stringify` は `<` をエスケープしないため、ニックネーム・ショップ名など
 * ユーザー入力由来の `name` に `</script><script>…` が含まれると script 要素を閉じられて
 * XSS になる（HTML パーサは script 内の文字列リテラルを解釈しない）。
 * どうやるか: HTML 的に意味を持つ `<` `>` `&` と、JS では行終端扱いになる U+2028 / U+2029 を
 * JSON として等価な Unicode エスケープへ置き換える（`JSON.parse` の結果は変わらない）。
 */
const serializeJsonLd = (value: unknown): string =>
    JSON.stringify(value)
        .replaceAll('<', '\\u003c')
        .replaceAll('>', '\\u003e')
        .replaceAll('&', '\\u0026')
        .replaceAll(' ', '\\u2028')
        .replaceAll(' ', '\\u2029');

/** JSON-LD 構造化データを生成する */
const generateJsonLd = (breadcrumbs: BreadcrumbEntry[]) => {
    const items = [
        { '@type': 'ListItem' as const, position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
        ...breadcrumbs.map((breadcrumb, index) => {
            const isLastItem = index === breadcrumbs.length - 1;
            return {
                '@type': 'ListItem' as const,
                position: index + 2,
                name: breadcrumb.name,
                ...(isLastItem ? {} : { item: `${SITE_URL}${breadcrumb.slug}` }),
            };
        }),
    ];

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items,
    };
};

export const Breadcrumbs = ({ breadcrumbs }: BreadcrumbsProps) => {
    const jsonLd = generateJsonLd(breadcrumbs);

    return (
        <>
            <script
                type="application/ld+json"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: <JSON-LD 構造化データの埋め込みは React の標準的なパターン。serializeJsonLd で `<` `>` `&` を Unicode エスケープ済みのため script の閉じタグ注入はできない>
                dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
            />
            <Breadcrumb aria-label="パンくずリスト" className="mx-auto w-full max-w-5xl px-4 pt-4">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink render={<Link href="/" />}>ホーム</BreadcrumbLink>
                    </BreadcrumbItem>
                    {breadcrumbs.flatMap((breadcrumb) => [
                        <BreadcrumbSeparator key={`sep-${breadcrumb.name}`} />,
                        <BreadcrumbItem key={breadcrumb.name}>
                            {breadcrumb.slug !== undefined ? (
                                <BreadcrumbLink render={<Link href={breadcrumb.slug as Route} />}>
                                    {breadcrumb.name}
                                </BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage>{breadcrumb.name}</BreadcrumbPage>
                            )}
                        </BreadcrumbItem>,
                    ])}
                </BreadcrumbList>
            </Breadcrumb>
        </>
    );
};
