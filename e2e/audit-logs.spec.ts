import { test, expect } from "@playwright/test";

// E2E فاز ۱۰ — لاگ عملیات از دید مدیر

test("لاگ عملیات: فیلتر + جدول + جزئیات", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/admin/audit-logs");
  await expect(page.getByRole("heading", { name: "لاگ عملیات" })).toBeVisible({ timeout: 15000 });

  // جدول لاگ‌ها
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });

  // کلیک روی ردیف → مودال جزئیات
  await page.locator("table tbody tr").first().click();
  await expect(page.getByText("بستن")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "بستن" }).click();

  // فیلتر عملیات
  await page.getByRole("button", { name: /همه عملیات/ }).click();
  await page.getByRole("option", { name: /ایجاد/ }).first().click();
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });
});
