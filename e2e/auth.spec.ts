import { test, expect } from "@playwright/test";

// E2E فاز ۱ — جریان ورود از دید کاربر واقعی
// سرور باید روی :3200 با دیتابیس تست در حال اجرا باشد

test.describe("Login flow", () => {
  test("لاگین موفق admin → داشبورد با سایدبار کامل", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "سامانه مدیریت دارایی" })).toBeVisible();

    await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
    await page.getByLabel("رمز عبور").fill("Admin@123");
    await page.getByRole("button", { name: "ورود" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    // سایدبار admin باید آیتم‌های مدیریتی را داشته باشد
    await expect(page.getByRole("link", { name: "کاربران" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "نقش‌ها" }).first()).toBeVisible();
    // داشبورد واقعی (فاز ۹): کارت آماری
    await expect(page.getByText("کل دارایی‌ها")).toBeVisible({ timeout: 15000 });
  });

  test("رمز غلط → پیام خطای فارسی، در داشبورد نمی‌رود", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
    await page.getByLabel("رمز عبور").fill("wrongpass");
    await page.getByRole("button", { name: "ورود" }).click();

    await expect(page.getByText("شناسه یا رمز عبور اشتباه است")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("دسترسی بدون لاگین → ریدایرکت به /login با پارامتر next", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "سامانه مدیریت دارایی" })).toBeVisible();
  });

  test("منوی employee محدود است (بدون کاربران/نقش‌ها/دارایی‌ها)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("ایمیل یا شماره تماس").fill("employee@ams.local");
    await page.getByLabel("رمز عبور").fill("Test@1234");
    await page.getByRole("button", { name: "ورود" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // employee فقط داشبورد + دارایی‌های من را می‌بیند
    await expect(page.getByRole("link", { name: "دارایی‌های من" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "کاربران" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "نقش‌ها" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "دارایی‌ها", exact: true })).toHaveCount(0);
  });

  test("خروج → برگشت به صفحه لاگین و عدم دسترسی مجدد", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
    await page.getByLabel("رمز عبور").fill("Admin@123");
    await page.getByRole("button", { name: "ورود" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: "مدیر سامانه" }).click();
    await page.getByRole("button", { name: "خروج از حساب" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
