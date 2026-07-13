const { test, expect } = require('@playwright/test');

// Feedback widget. It ships DORMANT — no endpoint configured means no UI — and
// activates only when assets/feedback-config.js provides an endpoint. Tests
// inject the endpoint via window.APDC_FEEDBACK_ENDPOINT (the config's `|| ""`
// guard lets an injected value win) and stub fetch to capture the POST.

const ENDPOINT = 'https://feedback.example.test/submit';

async function armWidget(page, { failFetch = false } = {}) {
  await page.addInitScript(({ endpoint, failFetch }) => {
    window.APDC_FEEDBACK_ENDPOINT = endpoint;
    window.__fbCalls = [];
    window.fetch = (url, opts) => {
      window.__fbCalls.push({ url, body: opts && opts.body });
      return Promise.resolve({
        ok: !failFetch,
        json: () => Promise.resolve({ ok: !failFetch, url: 'https://github.com/x/y/issues/1' })
      });
    };
  }, { endpoint: ENDPOINT, failFetch });
}

test('widget stays hidden when no endpoint is configured', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#feedback-launch')).toHaveCount(0);
});

test('opening, composing, and sending posts the feedback and thanks the user', async ({ page }) => {
  await armWidget(page);
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');

  const launch = page.locator('#feedback-launch');
  await expect(launch).toBeVisible();
  await launch.click();

  const panel = page.locator('#feedback-panel');
  await expect(panel).toBeVisible();

  // Pick a category and write a message.
  await panel.locator('.fb-cat[data-cat="bug"]').click();
  await expect(panel.locator('.fb-cat[data-cat="bug"]')).toHaveAttribute('aria-pressed', 'true');
  await panel.locator('#fb-message').fill('The Monday times look off on my phone.');
  await panel.locator('#fb-send').click();

  await expect(panel.locator('.fb-thanks')).toBeVisible();

  const calls = await page.evaluate(() => window.__fbCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe(ENDPOINT);
  const payload = JSON.parse(calls[0].body);
  expect(payload.category).toBe('bug');
  expect(payload.message).toContain('Monday times');
  expect(payload.page).toContain('/index.html');
  expect(payload.hp).toBe(''); // honeypot empty for a real person
});

test('a too-short message is blocked client-side before any request', async ({ page }) => {
  await armWidget(page);
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');
  await page.locator('#feedback-launch').click();
  await page.locator('#fb-message').fill('hi');
  await page.locator('#fb-send').click();
  await expect(page.locator('#fb-status')).toHaveText(/more detail/i);
  expect(await page.evaluate(() => window.__fbCalls.length)).toBe(0);
});

test('a failed send shows a retry-able error, not a false success', async ({ page }) => {
  await armWidget(page, { failFetch: true });
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');
  await page.locator('#feedback-launch').click();
  await page.locator('#fb-message').fill('Adding a real bug report here.');
  await page.locator('#fb-send').click();
  await expect(page.locator('#fb-status')).toHaveText(/try again/i);
  await expect(page.locator('.fb-thanks')).toHaveCount(0);
  await expect(page.locator('#fb-send')).toBeEnabled();
});

test('the honeypot field is present but visually hidden', async ({ page }) => {
  await armWidget(page);
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');
  await page.locator('#feedback-launch').click();
  const hp = page.locator('#fb-hp');
  await expect(hp).toHaveCount(1);
  // Off-screen and unreachable by keyboard / assistive tech, but still in the
  // DOM for bots to trip over.
  await expect(hp).toHaveAttribute('aria-hidden', 'true');
  await expect(hp).toHaveAttribute('tabindex', '-1');
  const box = await hp.boundingBox();
  expect(box.x).toBeLessThan(0);
});
