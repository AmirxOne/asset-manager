import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// فاز ۶ — تعمیرات و تأمین‌کنندگان

let admin: { cookie: string };
let employeeCookie: string;
let assetId: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  admin = await login("admin@ams.local", "Admin@123");
  employeeCookie = (await login("employee@ams.local", "Test@1234")).cookie;

  await prisma.maintenanceRecord.deleteMany({});
  await prisma.maintenancePart.deleteMany({});

  const lap = await prisma.assetType.findUnique({ where: { code: "LAP" } });
  const res = await api("/api/assets", {
    method: "POST", cookie: admin.cookie,
    body: JSON.stringify({ name: "دارایی تست تعمیر", assetTypeId: lap!.id }),
  });
  assetId = res.body.data.asset.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("maintenance lifecycle — قلب فاز ۶", () => {
  it("ثبت تعمیر: دارایی → MAINTENANCE + رویداد", async () => {
    const res = await api("/api/maintenances", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ assetId, problem: "صفحه‌نمایش نمی‌روشد", technicianName: "تعمیرکار آزمایشی" }),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.maintenance.status).toBe("OPEN");

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(asset!.status).toBe("MAINTENANCE");

    const ev = await prisma.assetEvent.findFirst({ where: { assetId, type: "MAINTENANCE" } });
    expect(ev).not.toBeNull();
  });

  it("تعمیر تکراری روی همان دارایی → 409 MAINTENANCE_OPEN", async () => {
    const res = await api("/api/maintenances", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ assetId, problem: "ایراد دیگر" }),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MAINTENANCE_OPEN");
  });

  it("شروع کار: OPEN → IN_PROGRESS", async () => {
    const open = await prisma.maintenanceRecord.findFirst({
      where: { assetId, status: "OPEN" },
    });
    const res = await api(`/api/maintenances/${open!.id}`, {
      method: "PATCH", cookie: admin.cookie,
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.maintenance.status).toBe("IN_PROGRESS");
  });

  it("افزودن قطعات + تکمیل: هزینه کل = دستی + قطعات", async () => {
    const record = await prisma.maintenanceRecord.findFirst({ where: { assetId } });

    // قطعات
    await api(`/api/maintenances/${record!.id}`, {
      method: "PATCH", cookie: admin.cookie,
      body: JSON.stringify({
        parts: [
          { name: "پنل LCD", quantity: 1, unitCost: "8000000" },
          { name: "پیچ‌-set", quantity: 2, unitCost: "50000" },
        ],
      }),
    });

    // تکمیل با هزینه دستی 200000
    const res = await api(`/api/maintenances/${record!.id}/complete`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ cost: "200000", returnTo: "IN_STOCK", condition: "GOOD" }),
    });
    expect(res.status).toBe(200);
    // 200000 + 8000000 + 2*50000 = 8300000
    expect(res.body.data.totalCost).toBe(8300000);

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(asset!.status).toBe("IN_STOCK");
    expect(asset!.lifecycleStage).toBe("REPAIRED");

    const done = await prisma.maintenanceRecord.findUnique({ where: { id: record!.id } });
    expect(done!.status).toBe("DONE");
    expect(Number(done!.cost)).toBe(8300000);

    const ev = await prisma.assetEvent.findFirst({ where: { assetId, type: "REPAIRED" } });
    expect(ev).not.toBeNull();
  });

  it("تکمیل دوباره تعمیر بسته → 409 MAINTENANCE_CLOSED", async () => {
    const done = await prisma.maintenanceRecord.findFirst({ where: { assetId, status: "DONE" } });
    const res = await api(`/api/maintenances/${done!.id}/complete`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ returnTo: "AVAILABLE" }),
    });
    expect(res.status).toBe(409);
  });

  it("لغو تعمیر: دارایی → AVAILABLE", async () => {
    // تعمیر جدید بساز و لغو کن
    await api("/api/maintenances", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ assetId, problem: "ایراد فرضی" }),
    });
    const open = await prisma.maintenanceRecord.findFirst({ where: { assetId, status: "OPEN" } });
    const res = await api(`/api/maintenances/${open!.id}`, {
      method: "PATCH", cookie: admin.cookie,
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    expect(res.status).toBe(200);

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(asset!.status).toBe("AVAILABLE");
  });

  it("ارسال دارایی RETIRED به تعمیر → 409", async () => {
    const lap = await prisma.assetType.findUnique({ where: { code: "LAP" } });
    const created = await api("/api/assets", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: "دارایی بازنشسته", assetTypeId: lap!.id }),
    });
    const id = created.body.data.asset.id;
    await api(`/api/assets/${id}/status`, {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "RETIRED" }),
    });
    const res = await api("/api/maintenances", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ assetId: id, problem: "تعمیر بازنشسته" }),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ASSET_INVALID_TRANSITION");
  });
});

describe("RBAC", () => {
  it("employee نمی‌تواند تعمیرات ببیند → 403", async () => {
    const res = await api("/api/maintenances", { cookie: employeeCookie });
    expect(res.status).toBe(403);
  });

  it("employee نمی‌تواند تعمیر ثبت کند → 403", async () => {
    const res = await api("/api/maintenances", {
      method: "POST", cookie: employeeCookie,
      body: JSON.stringify({ assetId, problem: "نفوذ" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("suppliers", () => {
  it("seed دو تأمین‌کننده دارد", async () => {
    const res = await api("/api/suppliers", { cookie: employeeCookie }); // لیست ساده برای همه
    expect(res.status).toBe(200);
    expect(res.body.data.suppliers.length).toBeGreaterThanOrEqual(2);
  });

  it("ایجاد + نام تکراری 409", async () => {
    const name = `تأمین تست ${Date.now() % 10000}`;
    const c = await api("/api/suppliers", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name, contactName: "رابط تست" }),
    });
    expect(c.status).toBe(201);

    const dup = await api("/api/suppliers", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name }),
    });
    expect(dup.status).toBe(409);
  });

  it("employee نمی‌تواند بسازد → 403", async () => {
    const res = await api("/api/suppliers", {
      method: "POST", cookie: employeeCookie,
      body: JSON.stringify({ name: "نفوذ" }),
    });
    expect(res.status).toBe(403);
  });

  it("تاریخچه خرید: دارایی با supplier", async () => {
    const sup = await prisma.supplier.findFirst();
    const lap = await prisma.assetType.findUnique({ where: { code: "LAP" } });
    await api("/api/assets", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({
        name: "خرید تستی", assetTypeId: lap!.id,
        supplierId: sup!.id, purchasePrice: "12000000",
      }),
    });
    const res = await api(`/api/suppliers/${sup!.id}`, { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.supplier.assets.length).toBeGreaterThanOrEqual(1);
  });
});

describe("warranties/expiring", () => {
  it("دارایی با گارانتی نزدیک در لیست", async () => {
    const lap = await prisma.assetType.findUnique({ where: { code: "LAP" } });
    const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await api("/api/assets", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: "گارانتی نزدیک", assetTypeId: lap!.id, warrantyEnd: soon }),
    });

    const res = await api("/api/warranties/expiring?withinDays=90", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.expiring.length).toBeGreaterThanOrEqual(1);
    const codes = res.body.data.expiring.map((a: { code: string }) => a.code);
    expect(codes.length).toBeGreaterThan(0);
  });
});
