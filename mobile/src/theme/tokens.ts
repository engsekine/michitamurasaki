/**
 * デザイントークン（Web と同一ブランド / spec 029 Assumption）。
 * packages/ui/src/styles/globals.css の :root（ライトテーマ・oklch）を
 * RN で扱える hex に変換して移植したもの。値を変える場合は Web 側と同時に更新する。
 *
 * NOTE: 当初計画は NativeWind によるトークン共有（plan.md R7）だったが、
 * RN 0.86 / Expo SDK 57 との互換が未検証のため、第 1 段階は TS 定数への移植とした。
 */
export const colors = {
    background: '#ffffff', // oklch(1 0 0)
    foreground: '#252525', // oklch(0.145 0 0)
    card: '#ffffff',
    primary: '#343434', // oklch(0.205 0 0)
    primaryForeground: '#fbfbfb', // oklch(0.985 0 0)
    secondary: '#f7f7f7', // oklch(0.97 0 0)
    muted: '#f7f7f7',
    mutedForeground: '#8e8e8e', // oklch(0.556 0 0)
    border: '#ebebeb', // oklch(0.922 0 0)
    destructive: '#d4183d', // oklch(0.577 0.245 27.325)
    ring: '#b5b5b5', // oklch(0.708 0 0)
    /** 転送状態バッジ用（Web の amber 系トーンに合わせる） */
    pending: '#b45309',
    pendingBg: '#fef3c7',
} as const;

/** --radius: 0.625rem = 10px を基準にした角丸（globals.css の radius スケールと同比率） */
export const radius = {
    sm: 6,
    md: 8,
    lg: 10,
    xl: 14,
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
} as const;

export const fontSize = {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 24,
} as const;

/** 最小タッチターゲット（a11y / contracts/app-screens.md） */
export const MIN_TOUCH_TARGET = 44;
