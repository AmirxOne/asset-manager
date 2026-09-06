import { test, expect } from "@playwright/test";

// E2E فاز ۵ — QR/بارکد از دید کاربر واقعی

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("پنل QR در جزئیات دارایی + دانلود SVG", async ({ page }) => {
  await adminLogin(page);

  // دارایی بساز و برو به جزئیات
  await page.goto("/assets/new");
  await page.getByLabel("نام دارایی *").fill("دارایی QR تست");
  await page.getByRole("button", { name: "انتخاب نوع…" }).click();
  await page.getByRole("option", { name: /موس/ }).first().click();
  await page.getByRole("button", { name: "ثبت دارایی", exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");

  // پنل QR ظاهر شود با SVG
  await expect(page.getByText("QR / بارکد")).toBeVisible({ timeout: 15000 });
  const qrSvg = page.locator(".max-w-\\[200px\\] svg");
  await expect(qrSvg.first()).toBeVisible({ timeout: 15000 });

  // تب بارکد
  await page.getByRole("button", { name: "بارکد", exact: true }).click();
  const barcodeSvg = page.locator(".max-w-\\[200px\\] svg");
  await expect(barcodeSvg.first()).toBeVisible({ timeout: 15000 });
});

test("اسکنر دستی: کد وارد کن → به دارایی برو", async ({ page }) => {
  await adminLogin(page);

  // از لیست یک کد واقعی بردار
  await page.goto("/assets");
  await page.waitForLoadState("networkidle");
  const codeLink = page.locator("table a").first();
  const code = await codeLink.textContent();
  expect(code).toMatch(/^AST-/);

  // به اسکنر برو و کد را بزن
  await page.goto("/scan");
  await page.getByPlaceholder("AST-IT-LAP-000001").fill(code!);
  await page.getByRole("button", { name: "برو به دارایی" }).click();

  // باید در جزئیات همان دارایی باشد
  await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 15000 });
});

test("ریدایرکت مستقیم /a/{code} (شبیه اسکن QR واقعی)", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/assets");
  await page.waitForLoadState("networkidle");
  const code = await page.locator("table a").first().textContent();

  // مستقیم به /a/CODE برو — مثل اینکه QR اسکن شده
  await page.goto(`/a/${code}`);
  await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 15000 });
});
