/** 問い合わせ種別の key→表示ラベル（service-front の選択肢と同値） */
export const INQUIRY_CATEGORY_LABELS: Record<string, string> = {
    question: 'ご質問',
    bug: '不具合報告',
    request: 'ご要望',
    other: 'その他',
};

/** 種別 key を表示ラベルに変換する（未知の値はそのまま返す） */
export const inquiryCategoryLabel = (category: string): string => INQUIRY_CATEGORY_LABELS[category] ?? category;
