import { test, expect } from "@playwright/test";

// E2E فاز ۴ — انبار و عملیات گروهی از دید کاربر

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("صفحه انبار — خلاصه و نمودارها", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/warehouse");

  await expect(page.getByRole("heading", { name: "انبار" })).toBeVisible();
  // کارت‌های آماری
  await expect(page.getByText("کل دارایی‌ها")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("در انبار").first()).toBeVisible();
  await expect(page.getByText("ارزش کل (ریال)")).toBeVisible();
  // نمودار وضعیت
  await expect(page.getByText("بر اساس وضعیت")).toBeVisible();
});

test("عملیات گروهی: انتخاب ۲ دارایی → تغییر وضعیت گروهی", async ({ page }) => {
  await adminLogin(page);

  // دو دارایی بساز (تا مطمئن باشیم حداقل ۲ تا IN_STOCK جدید هست)
  for (const name of ["دارایی گروهی A", "دارایی گروهی B"]) {
    await page.goto("/assets/new");
    await page.getByLabel("نام دارایی *").fill(name);
    await page.getByRole("button", { name: "انتخاب نوع…" }).click();
    await page.getByRole("option", { name: /کیبورد/ }).first().click();
    await page.getByRole("button", { name: "ثبت دارایی", exact: true }).click();
    await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 20000 });
  }

  await page.goto("/assets");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });

  // دو چک‌باکس اول را انتخاب کن
  const checkboxes = page.getByRole("checkbox");
  await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });
  const count = await checkboxes.count();
  expect(count).toBeGreaterThanOrEqual(2);
  await checkboxes.first().check();
  await checkboxes.nth(1).check();

  // نوار گروهی ظاهر شود
  await expect(page.getByText("۲ دارایی انتخاب شد")).toBeVisible();

  // تغییر وضعیت → موجود
  await page.getByRole("button", { name: "تغییر وضعیت" }).click();
  await page.getByRole("button", { name: "انتخاب وضعیت…" }).click();
  await page.getByRole("option", { name: "موجود" }).click();
  await page.getByRole("button", { name: /اجرا روی ۲ دارایی/ }).click();

  // گزارش موفقیت
  await expect(page.getByText(/با موفقیت انجام شد/)).toBeVisible({ timeout: 15000 });
});
