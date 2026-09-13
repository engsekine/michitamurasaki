import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { presetConsent } from './_helpers';

/** a11y スイープでバナーが重ならないよう同意済み Cookie をプリセット（017-cookie-consent） */
test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..', '..', 'src', 'app');

/** 認証必須の route group は別ファイルで扱うのでここでは対象外（(onboarding) も認証必須） */
const EXCLUDED_GROUPS = new Set(['(authenticated)', '(onboarding)']);

/**
 * `src/app/` 配下を再帰スキャンし、route group `()` を除いた URL に変換する。
 * 動的セグメント（`[id]` など）と `api/` は範囲外。
 */
function discoverPages(dir: string, urlSegments: string[] = []): string[] {
    const results: string[] = [];

    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);

        if (statSync(fullPath).isDirectory()) {
            if (EXCLUDED_GROUPS.has(entry)) continue;
            if (entry.startsWith('[')) continue;
            if (entry === 'api') continue;

            const isRouteGroup = entry.startsWith('(') && entry.endsWith(')');
            const nextSegments = isRouteGroup ? urlSegments : [...urlSegments, entry];
            results.push(...discoverPages(fullPath, nextSegments));
        } else if (entry === 'page.tsx' || entry === 'page.ts') {
            const path = urlSegments.length === 0 ? '/' : `/${urlSegments.join('/')}`;
            results.push(path);
        }
    }

    return results;
}

const PUBLIC_PAGES = discoverPages(APP_DIR);

for (const path of PUBLIC_PAGES) {
    test(`${path} - WCAG 2.1 AA 違反なし`, async ({ page: playwrightPage }) => {
        await playwrightPage.goto(path);
        await playwrightPage.waitForLoadState('networkidle');

        const results = await new AxeBuilder({
            page: playwrightPage,
        })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

        expect(results.violations).toEqual([]);
    });
}
