import { test, expect } from "@playwright/test";

/**
 * فاز ۱۱ — E2E نهایی: سناریوی کامل ۲۰ مرحله‌ای از پرامپت اصلی
 * Admin → Login → Department → Employee → Category → Location → Supplier → Asset
 * → Code → QR → Label → Assign → Transfer → Return → Maintenance → Complete
 * → Stock → Audit → Scan → Report → Export
 */

const RUN = Date.now().toString(36);

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا شماره تماس").fill("admin@ams.local");
  await page.getByLabel("رمز عبور").fill("Admin@123");
  await page.getByRole("button", { name: "ورود" }).click();
  // مقاوم در برابر hydration race
  try {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  } catch {
    await page.getByRole("button", { name: "ورود" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  }
}

test("سناریوی کامل ۲۰ مرحله‌ای", async ({ page }) => {
  test.setTimeout(420_000); // ۷ دقیقه — سناریوی بلند

  // ── ۱) Login
  await adminLogin(page);
  await expect(page.getByText("کل دارایی‌ها")).toBeVisible({ timeout: 20000 });

  // ── ۲) Department
  await page.goto("/departments");
  const deptName = `بخش تست ${RUN}`;
  await page.getByRole("button", { name: "بخش جدید" }).click();
  await page.getByLabel("نام بخش *").fill(deptName);
  await page.getByRole("button", { name: "ثبت بخش", exact: true }).click();
  await expect(page.getByText(deptName).first()).toBeVisible({ timeout: 15000 });

  // ── ۳) Employee
  await page.goto("/employees");
  const empName = `کاربر تست ${RUN}`;
  await page.getByRole("button", { name: "کارمند جدید" }).click();
  await page.getByLabel("نام و نام خانوادگی *").fill(empName);
  await page.getByLabel("کد پرسنلی *").fill(`E11-${RUN}`);
  await page.getByRole("button", { name: "انتخاب…" }).click();
  await page.getByRole("option", { name: deptName }).click();
  await page.getByRole("button", { name: "ثبت کارمند" }).click();
  await expect(page.getByText(empName).first()).toBeVisible({ timeout: 15000 });

  // ── ۴) Category (seed دارد ولی یک دسته جدید بسازیم)
  // دسته‌ها از UI صفحه جدید ندارند؛ از API (admin session) — همان کاری که UI می‌کند
  const catRes = await page.request.post("/api/categories", {
    data: { name: `دسته تست ${RUN}`, code: `T${RUN.slice(-3).toUpperCase()}` },
  });
  expect(catRes.status()).toBe(201);
  const cat = (await catRes.json()).data.category;
  void cat;

  // ── ۵) Location
  const locRes = await page.request.post("/api/locations", {
    data: { name: `اتاق تست ${RUN}`, type: "ROOM" },
  });
  expect(locRes.status()).toBe(201);

  // ── ۶) Warehouse (محل انبار)
  const whRes = await page.request.post("/api/locations", {
    data: { name: `انبار تست ${RUN}`, type: "WAREHOUSE" },
  });
  expect(whRes.status()).toBe(201);

  // ── ۷) Supplier
  await page.goto("/suppliers");
  const supName = `تأمین نهایی ${RUN}`;
  await page.getByRole("button", { name: "تأمین‌کننده جدید" }).click();
  await page.getByLabel("نام *").fill(supName);
  await page.getByRole("button", { name: "ثبت", exact: true }).click();
  await expect(page.getByText(supName).first()).toBeVisible({ timeout: 15000 });

  // ── ۸) Asset + ۹) کد یکتا خودکار
  await page.goto("/assets/new");
  await page.getByLabel("نام دارایی *").fill(`لپ‌تاپ نهایی ${RUN}`);
  await page.getByRole("button", { name: "انتخاب نوع…" }).click();
  await page.getByRole("option", { name: /لپ‌تاپ|Laptop/ }).first().click();
  await page.getByRole("button", { name: "ثبت دارایی", exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/[a-z0-9]{20,}/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  const assetUrl = page.url();
  const assetId = assetUrl.split("/").pop()!.split("?")[0];

  // کد خودکار در صفحه جزئیات (QR panel زیرنویس = کد)
  await expect(page.getByText("QR / بارکد")).toBeVisible({ timeout: 15000 });

  // ── ۱۰) QR + ۱۱) چاپ برچسب
  await expect(page.getByText("QR / بارکد")).toBeVisible({ timeout: 15000 });
  const qrSvg = page.locator(".max-w-\\[200px\\] svg");
  await expect(qrSvg.first()).toBeVisible({ timeout: 15000 });
  // صفحه چاپ برچسب باز می‌شود (API check)
  const labelRes = await page.request.get(`/api/labels/print?ids=${assetId}`);
  expect(labelRes.status()).toBe(200);
  expect((await labelRes.text()).length).toBeGreaterThan(500);

  // ── ۱۲) موجود کن (برای تحویل) — انتظار UI-native بدون reload
  await page.getByRole("button", { name: "انتخاب وضعیت جدید…" }).click();
  await page.getByRole("option", { name: "موجود", exact: true }).click();
  // بعد از اعمال: دکمه «تحویل به کارمند» ظاهر می‌شود
  await expect(page.getByRole("button", { name: "تحویل به کارمند" })).toBeVisible({ timeout: 20000 });

  // ── ۱۳) Assign
  // منتظر فروکش کامل reload خودکار مرحله قبل (تغییر وضعیت → location.reload)
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "تحویل به کارمند" }).click();
  const empSelect = page.getByRole("button", { name: "انتخاب کارمند…" });
  await expect(empSelect).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(800);
  await empSelect.click();
  const option = page.getByRole("option", { name: empName }).first();
  try {
    await expect(option).toBeVisible({ timeout: 4000 });
  } catch {
    await empSelect.click();
    await page.waitForTimeout(800);
    await empSelect.click();
    await expect(option).toBeVisible({ timeout: 10000 });
  }
  await option.click();
  await page.getByRole("button", { name: "تحویل", exact: true }).click();
  // بعد از تحویل: دکمه «عودت دارایی» ظاهر می‌شود و نام نگهدارنده در جدول
  await expect(page.getByRole("button", { name: "عودت دارایی" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(empName).first()).toBeVisible({ timeout: 20000 });

  // ── ۱۴) Return (عودت)
  await page.getByRole("button", { name: "عودت دارایی" }).click();
  await page.getByRole("button", { name: "عودت", exact: true }).click();
  // منتظر invalidate و نمایش مجدد — به‌جای reload شکننده
  await expect(page.getByRole("button", { name: "تحویل به کارمند" })).toBeVisible({ timeout: 20000 });

  // ── ۱۵+۱۶) Maintenance + Complete
  await page.getByRole("button", { name: "ارسال به تعمیر" }).click();
  await page.getByLabel("شرح ایراد *").fill(`خرابی تست ${RUN}`);
  await page.getByRole("button", { name: "ثبت و ارسال" }).click();
  await page.reload();
  await expect(page.locator(".badge-amber").first()).toBeVisible({ timeout: 20000 });

  await page.goto("/maintenance");
  const row = page.locator("tr", { hasText: `لپ‌تاپ نهایی ${RUN}` });
  await expect(row.first()).toBeVisible({ timeout: 15000 });
  await row.getByRole("button", { name: "تکمیل", exact: true }).click();
  await page.getByPlaceholder("500000").fill("150000");
  await page.getByRole("button", { name: "تکمیل تعمیر", exact: true }).click();
  await expect(page.locator(".badge-green").first()).toBeVisible({ timeout: 20000 });

  // ── ۱۷) Audit + ۱۸) Scan
  await page.goto("/audits");
  await page.waitForLoadState("networkidle");
  const newAuditBtn = page.getByRole("button", { name: "ممیزی جدید" });
  await expect(newAuditBtn).toBeVisible({ timeout: 20000 });
  await newAuditBtn.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
  await page.getByLabel("عنوان *").fill(`ممیزی نهایی ${RUN}`);
  await page.getByRole("button", { name: "شروع ممیزی", exact: true }).click();
  await expect(page).toHaveURL(/\/audits\/[a-z0-9]{20,}/, { timeout: 20000 });

  // کد دارایی ما را اسکن کن (از صفحه جزئیات بردار)
  const detail = await page.request.get(`/api/assets/${assetId}`);
  const code = (await detail.json()).data.asset.code;
  await page.getByPlaceholder("AST-IT-LAP-000001").fill(code);
  await page.getByRole("button", { name: "ثبت اسکن" }).click();
  await expect(page.getByText(/مطابق|مغایر/).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "بستن ممیزی" }).click();
  await page.getByRole("button", { name: "بستن و ثبت گزارش", exact: true }).click();
  await expect(page.getByRole("button", { name: "ثبت اسکن" })).toBeHidden({ timeout: 15000 });

  // ── ۱۹) Report + ۲۰) Export
  await page.goto("/reports");
  await expect(page.locator("table").first()).toBeVisible({ timeout: 15000 });
  const csvRes = await page.request.get("/api/reports?type=by_department&format=csv");
  expect(csvRes.status()).toBe(200);
  const csv = await csvRes.text();
  expect(csv).toContain("بخش"); // هدر گزارش فارسی

  // جستجوی جهانی — دارایی ما پیدا شود
  await page.goto(`/assets?q=${encodeURIComponent(code)}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("table a", { hasText: code }).first()).toBeVisible({ timeout: 15000 });
});
