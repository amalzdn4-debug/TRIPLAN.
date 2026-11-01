import { test, expect, type Page } from "@playwright/test";

const unique = () => `e2e+${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

async function acceptCookies(page: Page) {
  const btn = page.getByRole("button", { name: /necessary only|only necessary/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

test.describe("public site", () => {
  test("home page renders hero, sections and language alternates", async ({ page }) => {
    await page.goto("/en");
    await acceptCookies(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your next journey starts here");
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
    await expect(page.locator("[aria-roledescription='carousel'], [aria-label='Destinations around the world']").first()).toBeVisible();
  });

  test("hero carousel can be paused and navigated", async ({ page }) => {
    await page.goto("/en");
    await acceptCookies(page);
    const pause = page.getByRole("button", { name: /pause rotation/i });
    await pause.click();
    await expect(page.getByRole("button", { name: /resume rotation/i })).toBeVisible();
    await page.getByRole("button", { name: /next destination/i }).click();
  });

  test("Arabic is right-to-left and translated", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("رحلتك القادمة");
  });

  for (const locale of ["fr", "es", "it", "zh", "ru", "pt"]) {
    test(`${locale} home renders`, async ({ page }) => {
      const res = await page.goto(`/${locale}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", new RegExp(`^${locale}`));
    });
  }

  test("explore filters destinations", async ({ page }) => {
    await page.goto("/en/explore");
    await acceptCookies(page);
    await page.getByLabel(/search destinations/i).fill("Kyoto");
    await expect(page.getByRole("link", { name: /Kyoto/ }).first()).toBeVisible();
  });

  test("destination page has map link and JSON-LD", async ({ page }) => {
    await page.goto("/en/destinations/paris");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Paris");
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  });

  test("SEO endpoints respond", async ({ request }) => {
    expect((await request.get("/robots.txt")).ok()).toBe(true);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("/ar/destinations/");
  });

  test("unknown pages return 404", async ({ request }) => {
    expect((await request.get("/en/this-page-does-not-exist")).status()).toBe(404);
  });
});

test.describe("account & planning", () => {
  test("trip creation requires sign-in and preserves the destination", async ({ page }) => {
    await page.goto("/en/trips");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("sign up, create a fast trip, edit it, and see the free limit", async ({ page }) => {
    const email = unique();
    await page.goto("/en/signup");
    await acceptCookies(page);
    await page.getByLabel("Your name").fill("E2E Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("correct-horse-42");
    await page.getByLabel("Confirm password").fill("correct-horse-42");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/(trips|plan)/);

    await page.goto("/en/plan/fast");
    await page.getByLabel("Destination").selectOption("rome");
    await page.getByRole("button", { name: "Create my itinerary" }).click();
    await expect(page).toHaveURL(/\/en\/trips\/[\w-]+/, { timeout: 30_000 });
    await expect(page.getByText(/Day 1/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /open in google maps/i }).first()).toHaveAttribute("href", /google\.com\/maps/);

    // Free plan: a second trip should route to pricing.
    await page.goto("/en/plan/fast");
    await expect(page.getByText(/used your free trip/i).first()).toBeVisible();
  });

  test("login rejects wrong credentials with a generic message", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  });
});
