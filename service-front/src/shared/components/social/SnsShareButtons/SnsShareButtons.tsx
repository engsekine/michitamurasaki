import { FacebookIcon, XIcon } from './SnsBrandIcons';

interface SnsShareButtonsProps {
    /** 共有する canonical URL（SITE_URL ベースの絶対 URL）。呼び出し元が組み立てる */
    url: string;
    /** 共有テキスト（定型文）。呼び出し元が組み立てる */
    text: string;
}

/**
 * クエリは URLSearchParams で構築し、`#` `&`・絵文字を含むテキストでも欠落させない（SC-002）
 */
const xShareUrl = (text: string, url: string): string =>
    `https://x.com/intent/post?${new URLSearchParams({ text, url })}`;

/** Facebook はテキストを引き渡せない仕様のため URL のみ渡す（research.md R2） */
const facebookShareUrl = (url: string): string =>
    `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`;

const shareButtonClassName =
    'inline-flex size-11 items-center justify-center rounded-full border border-input text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2';

/**
 * SNS 共有ボタン（spec 035）。X / Facebook の共有インテント URL をアンカーで新しいタブに開く
 * （アンカー遷移はポップアップブロックの対象にならない）。Instagram は Web の共有インテントが
 * 存在せず、コピー方式の代替も UX が不十分なため提供しない（2026-07-16 改定 / research.md R3）。
 * 状態を持たないため Server Component。共有 URL・テキストの組み立ては
 * 呼び出し元の責務（contracts/sns-share-buttons.md）。
 */
export const SnsShareButtons = ({ url, text }: SnsShareButtonsProps) => (
    <ul className="flex items-center gap-2">
        <li>
            <a href={xShareUrl(text, url)} target="_blank" rel="noopener noreferrer" className={shareButtonClassName}>
                <XIcon className="size-5" />
                <span className="sr-only">X で共有</span>
            </a>
        </li>
        <li>
            <a href={facebookShareUrl(url)} target="_blank" rel="noopener noreferrer" className={shareButtonClassName}>
                <FacebookIcon className="size-5" />
                <span className="sr-only">Facebook で共有</span>
            </a>
        </li>
    </ul>
);
