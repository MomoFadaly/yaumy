import { test } from '@affine-test/kit/playwright';
import { locateFormatBar } from '@affine-test/kit/utils/editor';
import { openHomePage } from '@affine-test/kit/utils/load-page';
import {
  clickNewPageButton,
  waitForEmptyEditor,
} from '@affine-test/kit/utils/page-logic';
import { expect } from '@playwright/test';

function hexToRGB(hex: string) {
  hex = hex.replace(/^#/, '');
  const len = hex.length;
  let arr: string[] = [];

  if (len === 3 || len === 4) {
    arr = hex.split('').map(s => s.repeat(2));
  } else if (len === 6 || len === 8) {
    arr = Array.from<number>({ length: len / 2 })
      .fill(0)
      .map((n, i) => n + i * 2)
      .map(n => hex.substring(n, n + 2));
  }

  const values = arr
    .map(s => parseInt(s, 16))
    .map((n, i) => (i === 3 ? (n % 255) / 255 : n));

  return `rgb${values.length === 4 ? 'a' : ''}(${values.join(', ')})`;
}

test.beforeEach(async ({ page }) => {
  await openHomePage(page);
  await clickNewPageButton(page);
  await waitForEmptyEditor(page);
});

test.describe('Formatting', () => {
  test('should change text color', async ({ page }) => {
    await page.keyboard.press('Enter');

    await page.keyboard.type('hello world');
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');

    const formatBar = locateFormatBar(page);
    const highlightButton = formatBar.locator('affine-highlight-duotone-icon');

    await highlightButton.click();

    const fgGreenButton = formatBar.locator('[data-testid="foreground-green"]');
    await fgGreenButton.click();
    const fgColor = await fgGreenButton
      .locator('affine-text-duotone-icon')
      .evaluate(e => window.getComputedStyle(e).getPropertyValue('--color'));

    const paragraph = page.locator('affine-paragraph');
    const textSpan = paragraph
      .locator('affine-text:has-text("rld")')
      .locator('span')
      .first();

    await expect(textSpan).toBeVisible();

    await expect(textSpan).toHaveCSS('color', hexToRGB(fgColor));
  });

  test('should change text background color', async ({ page }) => {
    await page.keyboard.press('Enter');

    await page.keyboard.type('hello world');
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');

    const formatBar = locateFormatBar(page);
    const highlightButton = formatBar.locator('affine-highlight-duotone-icon');

    await highlightButton.click();

    const fgGreenButton = formatBar.locator('[data-testid="foreground-green"]');
    await fgGreenButton.click();

    await page.waitForTimeout(200);

    const fgColor = await fgGreenButton
      .locator('affine-text-duotone-icon')
      .evaluate(e => window.getComputedStyle(e).getPropertyValue('--color'));

    const paragraph = page.locator('affine-paragraph');
    const textSpan1 = paragraph
      .locator('affine-text:has-text("rld")')
      .locator('span')
      .first();

    await expect(textSpan1).toHaveCSS('color', hexToRGB(fgColor));

    await page.keyboard.press('ArrowRight');

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+ArrowLeft');
    }

    await highlightButton.click();

    const yellow = 'var(--affine-text-highlight-yellow)';
    const bgYellowButton = formatBar.locator(
      '[data-testid="background-yellow"]'
    );
    await bgYellowButton.click();

    const textSpan2 = paragraph
      .locator('affine-text:has-text("wo")')
      .locator('span')
      .first();

    await expect(textSpan2).toBeVisible();

    const bgColor1 = await textSpan1.evaluate(e => e.style.backgroundColor);
    const bgColor2 = await textSpan2.evaluate(e => e.style.backgroundColor);

    expect(yellow).toBe(bgColor1);
    expect(yellow).toBe(bgColor2);

    const bgColor = await bgYellowButton
      .locator('affine-text-duotone-icon')
      .evaluate(e =>
        window.getComputedStyle(e).getPropertyValue('--background')
      );

    await expect(textSpan1).toHaveCSS('background-color', hexToRGB(bgColor));
    await expect(textSpan2).toHaveCSS('background-color', hexToRGB(bgColor));
  });
});
