/** ダイバー種別の取りうる値（DB の CHECK 制約と一致させる）（019-diver-type） */
export const DIVER_TYPE_VALUES = ['instructor', 'general'] as const;

export type DiverType = (typeof DIVER_TYPE_VALUES)[number];

/** ラジオボタン描画用の順序付きオプション */
export const DIVER_TYPE_OPTIONS: ReadonlyArray<{ value: DiverType; label: string }> = [
    { value: 'instructor', label: 'インストラクター' },
    { value: 'general', label: '一般ダイバー' },
];
