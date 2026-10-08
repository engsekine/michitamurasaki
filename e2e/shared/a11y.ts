import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * axe-core によるアクセシビリティ検証の共通関数。
 * 以前は 12 本の spec がこの 4 行を各自で定義し、10 本がインラインで同じ呼び出しを書いていた。
 * 判定基準（WCAG 2.1 AA）を 1 か所にまとめ、基準変更時に全 spec が追随するようにする。
 */

/** プロジェクトの準拠基準（WCAG 2.1 AA）。rules/accessibility.md と揃える */
export const WCAG_21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/**
 * 現在のページに WCAG 2.1 AA 違反が無いことを検証する。
 * dev サーバーはオンデマンド配信のため、JS チャンク取得が落ち着く networkidle を待ってからスキャンする
 * （ハイドレーション前の DOM を誤検知しない）。
 */
export const expectNoViolations = async (page: Page): Promise<void> => {
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags([...WCAG_21_AA_TAGS]).analyze();
    expect(results.violations).toEqual([]);
};
