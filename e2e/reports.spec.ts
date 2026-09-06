import { test, expect } from "@playwright/test";

// E2E فاز ۹ — داشبورد و گزارش‌ها از دید کاربر

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("داشبورد: کارت‌ها + رویدادها + لینک‌ها", async ({ page }) => {
  await adminLogin(page);

  await expect(page.getByRole("heading", { name: "داشبورد" })).toBeVisible({ timeout: 15000 });
  // کارت‌های آماری
  await expect(page.getByText("کل دارایی‌ها")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("در اختیار").first()).toBeVisible();
  await expect(page.getByText("ارزش کل (ریال)")).toBeVisible();
  // لیست رویدادها
  await expect(page.getByText("آخرین رویدادها")).toBeVisible();

  // کلیک روی کارت «کل دارایی‌ها» → لیست دارایی‌ها
  await page.getByText("کل دارایی‌ها").click();
  await expect(page).toHaveURL(/\/assets/, { timeout: 10000 });
});

test("گزارش‌ها: انتخاب نوع + جدول + دانلود CSV", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/reports");

  // گزارش پیش‌فرض
  await expect(page.getByText("به تفکیک دسته").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("table").first()).toBeVisible({ timeout: 15000 });

  // تغییر نوع به وضعیت
  await page.getByRole("button", { name: "به تفکیک دسته" }).click();
  await page.getByRole("option", { name: "به تفکیک وضعیت" }).click();
  await expect(page.getByText("وضعیت").first()).toBeVisible({ timeout: 10000 });

  // دانلود CSV — درخواست مستقیم (API همان UI است)
  const res = await page.request.get("/api/reports?type=by_status&format=csv");
  expect(res.status()).toBe(200);
  expect((await res.text()).length).toBeGreaterThan(10);
});
