/**
 * SNS ブランドアイコン（spec 035 FR-008 / research.md R4）。
 * 外部 CDN・アイコンライブラリに依存せず SVG を同梱する（lucide-react は X ロゴ非収録）。
 * X のモノクログリフは currentColor でテーマ（ライト/ダーク）に追従させ、
 * Facebook はブランドブルー固定。いずれも装飾扱い（aria-hidden）で、
 * アクセシブルな名前はボタン側のテキストが担保する。
 * SnsShareButtons 内部専用（index.ts からは公開しない）。
 */

interface BrandIconProps {
    className?: string;
}

export const XIcon = ({ className }: BrandIconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

export const FacebookIcon = ({ className }: BrandIconProps) => (
    <svg viewBox="0 0 24 24" fill="#0866FF" aria-hidden="true" className={className}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);
