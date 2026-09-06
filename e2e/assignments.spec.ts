import { test, expect } from "@playwright/test";

// E2E فاز ۳ — از دید کاربر واقعی: کارمند بساز → دارایی بساز → تحویل بده → انتقال → عودت

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("چرخه کامل تخصیص در UI", async ({ page }) => {
  await adminLogin(page);

  // ۱) بخش بساز
  await page.goto("/departments");
  await page.getByRole("button", { name: "بخش جدید" }).click();
  const deptName = `بخش تست ${Date.now() % 10000}`;
  await page.getByLabel("نام بخش *").fill(deptName);
  await page.getByRole("button", { name: "ثبت بخش", exact: true }).click();
  await expect(page.getByText(deptName)).toBeVisible({ timeout: 10000 });

  // ۲) کارمند بساز (نام یکتا per-run)
  const run = Date.now() % 100000;
  const empName = `زهرا تستی ${run}`;
  const empCode = `E2E-${run}`;
  await page.goto("/employees");
  await page.getByRole("button", { name: "کارمند جدید" }).click();
  await page.getByLabel("نام و نام خانوادگی *").fill(empName);
  await page.getByLabel("کد پرسنلی *").fill(empCode);
  // انتخاب بخش
  await page.getByRole("button", { name: "انتخاب…" }).click();
  await page.getByRole("option", { name: deptName }).click();
  await page.getByRole("button", { name: "ثبت کارمند" }).click();
  await expect(page.getByText(empName).first()).toBeVisible({ timeout: 10000 });

  // ۳) کارمند دوم برای انتقال
  await page.getByRole("button", { name: "کارمند جدید" }).click();
  const emp2Name = `حسین منتقل ${run}`;
  await page.getByLabel("نام و نام خانوادگی *").fill(emp2Name);
  await page.getByLabel("کد پرسنلی *").fill(`${empCode}-2`);
  await page.getByRole("button", { name: "ثبت کارمند" }).click();
  await expect(page.getByText(emp2Name).first()).toBeVisible({ timeout: 10000 });

  // ۴) دارایی بساز
  await page.goto("/assets/new");
  await page.getByLabel("نام دارایی *").fill("موس چرخه تخصیص");
  await page.getByRole("button", { name: "انتخاب نوع…" }).click();
  await page.getByRole("option", { name: /موس/ }).first().click();
  await page.getByRole("button", { name: "ثبت دارایی", exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 20000 });

  // ۵) موجود کن بعد تحویل بده
  await page.getByRole("button", { name: "انتخاب وضعیت جدید…" }).click();
  await page.getByRole("option", { name: "موجود" }).click();
  await expect(page.locator(".badge-blue").first()).toBeVisible({ timeout: 10000 });
  // صبر برای رفرش کامل صفحه (در فایل detail بعد از تغییر وضعیت reload می‌شود)
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const assignBtn = page.getByRole("button", { name: "تحویل به کارمند" });
  await expect(assignBtn).toBeVisible({ timeout: 15000 });
  await assignBtn.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
  const empSelect = page.getByRole("button", { name: "انتخاب کارمند…" });
  await expect(empSelect).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(800); // گزینه‌ها fetch شوند
  // دراپ‌داون را باز کن و منتظر گزینه شو
  await empSelect.click();
  let option = page.getByRole("option", { name: empName }).first();
  try {
    await expect(option).toBeVisible({ timeout: 4000 });
  } catch {
    // هنوز لود نشده — ببند و دوباره باز کن
    await empSelect.click();
    await page.waitForTimeout(800);
    await empSelect.click();
    await expect(option).toBeVisible({ timeout: 10000 });
  }
  await option.click();
  await page.getByRole("button", { name: "تحویل", exact: true }).click();
  await page.reload();
  await expect(page.getByText("تحویل‌شده").first()).toBeVisible({ timeout: 10000 });

  // ۶) انتقال
  await page.getByRole("button", { name: "انتقال به کارمند دیگر" }).click();
  const emp2Select = page.getByRole("button", { name: "انتخاب کارمند…" });
  await expect(emp2Select).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(800);
  await emp2Select.click();
  let option2 = page.getByRole("option", { name: emp2Name }).first();
  try {
    await expect(option2).toBeVisible({ timeout: 4000 });
  } catch {
    await emp2Select.click();
    await page.waitForTimeout(800);
    await emp2Select.click();
    await expect(option2).toBeVisible({ timeout: 10000 });
  }
  await option2.click();
  await page.getByRole("button", { name: "انتقال", exact: true }).click();
  await page.reload();
  await expect(page.getByText("انتقال").first()).toBeVisible({ timeout: 10000 });

  // ۷) عودت به انبار
  await page.getByRole("button", { name: "عودت دارایی" }).click();
  await page.getByRole("button", { name: /موجود \(آزاد\)|در انبار/ }).click();
  await page.getByRole("option", { name: "در انبار" }).click();
  await page.getByRole("button", { name: "عودت", exact: true }).click();
  await page.reload();
  await expect(page.locator(".badge-green").first()).toBeVisible({ timeout: 10000 });

  // ۸) بعد عودت: badge سبز (در انبار/موجود) و تاریخچه انتقال
  await expect(page.locator(".badge-green").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("انتقال", { exact: true }).first()).toBeVisible();
});
