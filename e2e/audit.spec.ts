import { test, expect } from "@playwright/test";

// E2E فاز ۸ — ممیزی از دید کاربر واقعی

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("چرخه کامل ممیزی در UI: ایجاد → اسکن‌ها → بستن", async ({ page }) => {
  await adminLogin(page);

  // ۱) ایجاد ممیزی
  await page.goto("/audits");
  await page.getByRole("button", { name: "ممیزی جدید" }).click();
  const title = `شمارش E2E ${Date.now() % 10000}`;
  await page.getByLabel("عنوان *").fill(title);
  await page.getByRole("button", { name: "شروع ممیزی", exact: true }).click();
  await expect(page).toHaveURL(/\/audits\/[a-z0-9]{20,}/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  // ۲) شمارنده انتظار دیده شود
  await expect(page.getByText("انتظار").first()).toBeVisible({ timeout: 15000 });

  // ۳) کد یک دارایی واقعی از لیست بگیر
  const codesRes = await page.request.get("/api/assets?pageSize=5");
  const body = await codesRes.json();
  const codes: string[] = body.data.data.map((a: { code: string }) => a.code);
  expect(codes.length).toBeGreaterThanOrEqual(2);

  // ۴) اسکن اول — MATCH (یا MISMATCH — مهم این است که نتیجه نمایش داده شود)
  const scanBox = page.getByPlaceholder("AST-IT-LAP-000001");
  await scanBox.fill(codes[0]);
  await page.getByRole("button", { name: "ثبت اسکن" }).click();
  await expect(page.getByText(/مطابق|مغایر/).first()).toBeVisible({ timeout: 15000 });

  // ۵) اسکن کد ناشناخته — غیرمنتظره
  await scanBox.fill("AST-XX-ZZZ-999999");
  await page.getByRole("button", { name: "ثبت اسکن" }).click();
  await expect(page.getByText("غیرمنتظره").first()).toBeVisible({ timeout: 15000 });

  // ۶) شمارنده اسکن‌شده ≥ 2
  await expect(page.locator("text=اسکن‌شده").locator("..").locator("p").first()).toContainText(/۲|۳|۴|۵/);

  // ۷) بستن ممیزی
  await page.getByRole("button", { name: "بستن ممیزی" }).click();
  await page.getByRole("button", { name: "بستن و ثبت گزارش", exact: true }).click();
  // بعد از بستن، دکمه اسکن محو می‌شود (session بسته)
  await expect(page.getByRole("button", { name: "ثبت اسکن" })).toBeHidden({ timeout: 15000 });
});
