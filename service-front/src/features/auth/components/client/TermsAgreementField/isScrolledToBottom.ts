/**
 * スクロール要素が最下部（しきい値以内）まで到達したかを判定する純関数。
 * 端数・小数ズーム対策で既定 8px の許容を持たせる。コンテンツがビューより短い
 * （スクロール不要）場合も「到達済み」とみなす。
 */
export const isScrolledToBottom = (
    { scrollTop, clientHeight, scrollHeight }: Pick<HTMLElement, 'scrollTop' | 'clientHeight' | 'scrollHeight'>,
    threshold = 8,
): boolean => scrollTop + clientHeight >= scrollHeight - threshold;
