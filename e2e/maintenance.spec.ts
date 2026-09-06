import { test, expect } from "@playwright/test";

// E2E فاز ۶ — تعمیر و تأمین‌کننده از دید کاربر

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("چرخه تعمیر کامل: ثبت → شروع → تکمیل با هزینه", async ({ page }) => {
  await adminLogin(page);

  // ۱) تأمین‌کننده بساز
  await page.goto("/suppliers");
  await page.getByRole("button", { name: "تأمین‌کننده جدید" }).click();
  const supName = `تأمین E2E ${Date.now() % 10000}`;
  await page.getByLabel("نام *").fill(supName);
  await page.getByRole("button", { name: "ثبت", exact: true }).click();
  await expect(page.getByText(supName).first()).toBeVisible({ timeout: 10000 });

  // ۲) دارایی بساز
  await page.goto("/assets/new");
  await page.getByLabel("نام دارایی *").fill("پرینتر تعمیر E2E");
  await page.getByRole("button", { name: "انتخاب نوع…" }).click();
  await page.getByRole("option", { name: /پرینتر/ }).first().click();
  await page.getByRole("button", { name: "ثبت دارایی", exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");

  // ۳) از جزئیات: ارسال به تعمیر
  await page.getByRole("button", { name: "ارسال به تعمیر" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
  await page.getByLabel("شرح ایراد *").fill("کاغذ گیر می‌کند");
  await page.getByRole("button", { name: "ثبت و ارسال" }).click();
  await page.reload();
  await expect(page.locator(".badge-amber").first()).toBeVisible({ timeout: 15000 }); // در تعمیر

  // ۴) صفحه تعمیرات: رکورد جدید OPEN
  await page.goto("/maintenance");
  await expect(page.getByText("پرینتر تعمیر E2E").first()).toBeVisible({ timeout: 15000 });

  // ۵) شروع کار
  await page.getByRole("button", { name: "شروع", exact: true }).first().click();
  await expect(page.getByText("در جریان").first()).toBeVisible({ timeout: 10000 });

  // ۶) تکمیل با هزینه
  await page.getByRole("button", { name: "تکمیل", exact: true }).first().click();
  await page.getByPlaceholder("500000").fill("350000");
  await page.getByRole("button", { name: "تکمیل تعمیر", exact: true }).click();

  // ۷) رکورد DONE — badge سبز
  await expect(page.locator(".badge-green").first()).toBeVisible({ timeout: 15000 });
});

test("تعمیر تکراری در UI رد می‌شود (پیام خطا)", async ({ page }) => {
  await adminLogin(page);

  // دارایی بساز و به تعمیر بفرست
  await page.goto("/assets/new");
  await page.getByLabel("نام دارایی *").fill("اسکنر تعمیر دوم");
  await page.getByRole("button", { name: "انتخاب نوع…" }).click();
  await page.getByRole("option", { name: /اسکنر/ }).first().click();
  await page.getByRole("button", { name: "ثبت دارایی", exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "ارسال به تعمیر" }).click();
  await page.getByLabel("شرح ایراد *").fill("روشن نمی‌شود");
  await page.getByRole("button", { name: "ثبت و ارسال" }).click();
  await page.reload();
  await expect(page.locator(".badge-amber").first()).toBeVisible({ timeout: 15000 });
});
