import { test, expect } from "@playwright/test";

// E2E فاز ۲ — دارایی از دید کاربر واقعی: ایجاد → کد خودکار → جزئیات → تاریخچه → تغییر وضعیت

const RUN = Date.now().toString(36); // یکتا per-run — DB تست بین اجراها پاک نمی‌شود

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Asset CRUD E2E", () => {
  test("ایجاد دارایی با کد خودکار → جزئیات → تاریخچه → تغییر وضعیت", async ({ page }) => {
    await adminLogin(page);

    await page.goto("/assets/new");
    await expect(page.getByRole("heading", { name: "ثبت دارایی جدید" })).toBeVisible();

    await page.getByLabel("نام دارایی *").fill("لپ‌تاپ تست E2E");
    await page.getByRole("button", { name: "انتخاب نوع…" }).click();
    await page.getByRole("option", { name: /لپ‌تاپ/ }).first().click();
    await page.getByLabel("برند").fill("Lenovo");
    await page.getByLabel("مدل").fill("ThinkPad");
    await page.getByLabel("شماره سریال (در صورت وجود یکتاست)").fill(`E2E-${RUN}-001`);

    await page.getByRole("button", { name: "ثبت دارایی" }).click();

    // regex دقیق: /assets/{cuid} — نه /assets/new
    await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 20000 });
    await expect(page.locator("h1 ~ span").first()).toContainText("AST-IT-LAP-");

    // رویداد «ایجاد» در تاریخچه
    await expect(page.getByText("ایجاد", { exact: true }).first()).toBeVisible({ timeout: 10000 });

    // تغییر وضعیت: IN_STOCK → AVAILABLE
    await page.getByRole("button", { name: "انتخاب وضعیت جدید…" }).click();
    await page.getByRole("option", { name: "موجود" }).click();
    // badge سبز «موجود» بالای صفحه
    await expect(page.locator(".badge-green").first()).toBeVisible({ timeout: 10000 });
  });

  test("جستجو و فیلتر در لیست دارایی‌ها", async ({ page }) => {
    await adminLogin(page);

    // مستقل: دارایی خودش را می‌سازد
    await page.goto("/assets/new");
    await page.getByLabel("نام دارایی *").fill("مانیتور تست لیست");
    await page.getByRole("button", { name: "انتخاب نوع…" }).click();
    await page.getByRole("option", { name: /مانیتور/ }).first().click();
    await page.getByLabel("شماره سریال (در صورت وجود یکتاست)").fill(`E2E-${RUN}-002`);
    await page.getByRole("button", { name: "ثبت دارایی" }).click();
    await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 20000 });

    // لیست + جستجوی سریال
    await page.goto("/assets");
    await page.getByPlaceholder("کد، نام، برند، مدل، سریال…").fill(`E2E-${RUN}-002`);
    await expect(page.getByText("مانیتور تست لیست")).toBeVisible({ timeout: 15000 });

    // فیلتر وضعیت = در انبار
    await page.getByRole("button", { name: /وضعیت/ }).first().click();
    await page.getByRole("option", { name: "در انبار" }).click();
    await expect(page.getByText("مانیتور تست لیست")).toBeVisible({ timeout: 15000 });
  });

  test("کد تکراری دستی → خطای فارسی در فرم", async ({ page }) => {
    await adminLogin(page);

    // کد یکتا per-run (۶ رقم از زمان)
    const fixedCode = `AST-IT-LAP-${String(100000 + (Date.now() % 900000))}`;

    // اول یک دارایی با این کد بسازیم (رکورد پایه)
    await page.goto("/assets/new");
    await page.getByLabel("نام دارایی *").fill("دارایی پایه کد ثابت");
    await page.getByRole("button", { name: "انتخاب نوع…" }).click();
    await page.getByRole("option", { name: /لپ‌تاپ/ }).first().click();
    await page.getByLabel("کد دستی (اختیاری)").fill(fixedCode);
    await page.getByRole("button", { name: "ثبت دارایی" }).click();
    await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 20000 });

    // حالا کد تکراری
    await page.goto("/assets/new");
    await page.getByLabel("نام دارایی *").fill("تست تکراری");
    await page.getByRole("button", { name: "انتخاب نوع…" }).click();
    await page.getByRole("option", { name: /لپ‌تاپ/ }).first().click();
    await page.getByLabel("کد دستی (اختیاری)").fill(fixedCode);

    await page.getByRole("button", { name: "ثبت دارایی" }).click();
    await expect(page.getByText("کد دارایی تکراری است")).toBeVisible({ timeout: 15000 });
    // هنوز در فرم است
    await expect(page).toHaveURL(/\/assets\/new/);
  });
});
