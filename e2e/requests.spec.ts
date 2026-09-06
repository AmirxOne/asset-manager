import { test, expect } from "@playwright/test";

// E2E فاز ۷ — گردش درخواست از دید کاربر واقعی (سه نقش)

async function login(page: import("@playwright/test").Page, chip: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: chip, exact: true }).click();
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function switchUser(page: import("@playwright/test").Page, chip: string) {
  await page.context().clearCookies();
  await login(page, chip);
}

test("گردش کامل: کارمند ثبت → مدیر بخش تأیید → IT تأیید → زنگ اعلان", async ({ page }) => {
  const run = Date.now() % 10000;
  const title = `مانیتور دوم ${run}`;

  // ۱) کارمند درخواست می‌سازد
  await login(page, "کارمند");
  await page.goto("/requests");
  await page.getByRole("button", { name: "درخواست جدید" }).click();
  await page.getByLabel("عنوان *").fill(title);
  await page.getByRole("button", { name: "ثبت درخواست", exact: true }).click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("در انتظار تأیید مدیر").first()).toBeVisible();

  // ۲) مدیر بخش تأیید می‌کند
  await switchUser(page, "مدیر بخش");
  await page.goto("/requests");
  await page.getByRole("button", { name: "درخواست‌های من" }).click();
  await page.getByRole("option", { name: "همه درخواست‌ها" }).click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 });

  const row = page.locator("tr", { hasText: title });
  await row.getByRole("button", { name: "تأیید", exact: true }).click();
  await expect(page.getByText("تأیید مدیر — در انتظار IT").first()).toBeVisible({ timeout: 10000 });

  // ۳) مدیر IT تأیید می‌کند → آماده تأمین
  await switchUser(page, "مدیر IT");
  await page.goto("/requests");
  await page.getByRole("button", { name: "درخواست‌های من" }).click();
  await page.getByRole("option", { name: "همه درخواست‌ها" }).click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 });
  const row2 = page.locator("tr", { hasText: title });
  await row2.getByRole("button", { name: "تأیید IT", exact: true }).click();
  await expect(page.getByText("تأیید IT — آماده تأمین").first()).toBeVisible({ timeout: 10000 });

  // ۴) کارمند: زنگ اعلان با خبر تأیید
  await switchUser(page, "کارمند");
  await page.goto("/dashboard");
  const bell = page.getByRole("button", { name: "اعلان‌ها" });
  await expect(bell).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000); // اولین fetch
  await bell.click();
  // پنل اعلان باز شد — عنوان اعلان تأیید
  await expect(page.locator("div").filter({ hasText: "تأیید IT شد" }).first()).toBeVisible({ timeout: 15000 });
});
