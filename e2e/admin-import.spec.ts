import { test, expect } from "@playwright/test";

// E2E تکمیلی — ورود CSV از UI + صفحه کاربران

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
}

test("import CSV: پیش‌نمایش → ثبت → کدها", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/assets/import");

  const run = Date.now() % 100000;
  const csv = `name,typeCode,brand,serialNumber
مانیتور ایمپورت UI ${run},MON,LG,UIIMP-${run}
ردیف خراب UI ${run},NOPE,,X-${run}`;

  await page.locator("textarea").fill(csv);
  await page.getByRole("button", { name: "اعتبارسنجی و پیش‌نمایش" }).click();

  // پیش‌نمایش: ۱ معتبر + ۱ خطا
  await expect(page.getByText("معتبر: ۱").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("خطا: ۱").first()).toBeVisible();
  await expect(page.getByText(/کد نوع «NOPE» وجود ندارد/).first()).toBeVisible();

  // ثبت
  await page.getByRole("button", { name: /ثبت ۱ دارایی معتبر/ }).click();
  await expect(page.getByText(/۱ دارایی ساخته شد/).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/AST-/).first()).toBeVisible({ timeout: 10000 });
});

test("صفحه کاربران ادمین: لیست + نقش‌ها دیده می‌شوند", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/users");

  await expect(page.getByRole("heading", { name: "کاربران" })).toBeVisible({ timeout: 15000 });
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });
  // نقش ابرمدیر
  await expect(page.getByText("ابرمدیر").first()).toBeVisible();

  // صفحه نقش‌ها
  await page.goto("/admin/roles");
  await expect(page.getByText("نقش‌ها و مجوزها")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/۷ نقش/).first()).toBeVisible();
});
