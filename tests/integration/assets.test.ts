import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// فاز ۲ — Asset core: کد خودکار، CRUD، گذار وضعیت، تاریخچه، RBAC

let admin: { cookie: string };
let employeeCookie: string;
let itStaffCookie: string;
let typeId: string;
let catId: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  admin = await login("admin@ams.local", "Admin@123");
  employeeCookie = (await login("employee@ams.local", "Test@1234")).cookie;
  itStaffCookie = (await login("itstaff@ams.local", "Test@1234")).cookie;

  // برای تست یکتایی سریال از رکوردهای قبلی پاک کنیم
  await prisma.asset.deleteMany({});
  await prisma.codeSequence.deleteMany({});

  const cat = await prisma.assetCategory.findUnique({ where: { code: "IT" } });
  const type = await prisma.assetType.findUnique({ where: { code: "LAP" } });
  if (!cat || !type) throw new Error("seed categories missing");
  catId = cat.id;
  typeId = type.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createAsset(overrides: Record<string, unknown> = {}) {
  const res = await api("/api/assets", {
    method: "POST",
    cookie: admin.cookie,
    body: JSON.stringify({
      name: "لپ‌تاپ تست",
      assetTypeId: typeId,
      ...overrides,
    }),
  });
  return res;
}

describe("POST /api/assets — تولید کد خودکار", () => {
  it("کد خودکار با قالب AST-IT-LAP-000001", async () => {
    const res = await createAsset();
    expect(res.status).toBe(201);
    expect(res.body.data.asset.code).toMatch(/^AST-IT-LAP-\d{6}$/);
  });

  it("کدهای متوالی یکتا و صعودی هستند", async () => {
    const [r1, r2, r3] = await Promise.all([createAsset(), createAsset(), createAsset()]);
    const codes = [r1, r2, r3].map((r) => r.body.data.asset.code);
    expect(new Set(codes).size).toBe(3); // یکتا حتی همزمان
    const seqs = codes.map((c) => Number(c.split("-")[3])).sort((a, b) => a - b);
    expect(seqs[1]).toBe(seqs[0] + 1);
    expect(seqs[2]).toBe(seqs[1] + 1); // بدون gap
  });

  it("پیشوند هر نوع جدا شمارش می‌شود (AST-NET-SRV-…)", async () => {
    const srvType = await prisma.assetType.findUnique({ where: { code: "SRV" } });
    const res = await createAsset({ assetTypeId: srvType!.id, name: "سرور تست" });
    expect(res.body.data.asset.code).toMatch(/^AST-NET-SRV-\d{6}$/);
  });

  it("کد دستی معتبر پذیرفته و تکرارش 409", async () => {
    const r1 = await createAsset({ code: "AST-IT-LAP-900001" });
    expect(r1.status).toBe(201);
    expect(r1.body.data.asset.code).toBe("AST-IT-LAP-900001");

    const r2 = await createAsset({ code: "AST-IT-LAP-900001" });
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe("DUPLICATE_CODE");
  });
});

describe("POST /api/assets — اعتبارسنجی", () => {
  it("سریال تکراری → 409", async () => {
    await createAsset({ serialNumber: "SN-UNIQUE-1" });
    const dup = await createAsset({ serialNumber: "SN-UNIQUE-1" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("DUPLICATE_SERIAL");
  });

  it("بدون نام → 400", async () => {
    const res = await createAsset({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("نوع نامعتبر → 404", async () => {
    const res = await createAsset({ assetTypeId: "nonexistent" });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/assets — لیست و فیلترها", () => {
  it("فیلتر ترکیبی: status + categoryId + جستجو", async () => {
    // همه IN_STOCK هستند بعد از seed تست
    const res = await api(
      `/api/assets?status=IN_STOCK&categoryId=${catId}&q=${encodeURIComponent("لپ‌تاپ")}`,
      { cookie: admin.cookie },
    );
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    for (const a of res.body.data.data) {
      expect(a.status).toBe("IN_STOCK");
      expect(a.assetType.category.code).toBe("IT");
    }
  });

  it("جستجوی سریال کار می‌کند", async () => {
    const res = await api(`/api/assets?q=SN-UNIQUE-1`, { cookie: admin.cookie });
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.data[0].serialNumber).toBe("SN-UNIQUE-1");
  });

  it("pagination: pageSize رعایت می‌شود", async () => {
    const res = await api(`/api/assets?page=1&pageSize=2`, { cookie: admin.cookie });
    expect(res.body.data.data.length).toBeLessThanOrEqual(2);
    expect(res.body.data.pageSize).toBe(2);
  });
});

describe("POST /api/assets/{id}/status — ماشین گذار", () => {
  it("چرخه سالم: IN_STOCK → AVAILABLE → MAINTENANCE → AVAILABLE", async () => {
    const created = await createAsset();
    const id = created.body.data.asset.id;

    const t1 = await api(`/api/assets/${id}/status`, {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "AVAILABLE" }),
    });
    expect(t1.status).toBe(200);
    expect(t1.body.data.asset.status).toBe("AVAILABLE");

    const t2 = await api(`/api/assets/${id}/status`, {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "MAINTENANCE" }),
    });
    expect(t2.status).toBe(200);

    const t3 = await api(`/api/assets/${id}/status`, {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "AVAILABLE" }),
    });
    expect(t3.status).toBe(200);
    expect(t3.body.data.asset.lifecycleStage).toBe("REPAIRED");
  });

  it("گذار غیرمجاز → 409 ASSET_INVALID_TRANSITION", async () => {
    const created = await createAsset();
    const id = created.body.data.asset.id;
    // IN_STOCK → IN_USE مجاز نیست
    const res = await api(`/api/assets/${id}/status`, {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "IN_USE" }),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ASSET_INVALID_TRANSITION");
  });

  it("هر گذار AssetEvent ثبت می‌کند", async () => {
    const created = await createAsset();
    const id = created.body.data.asset.id;
    await api(`/api/assets/${id}/status`, {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "AVAILABLE" }),
    });
    const events = await prisma.assetEvent.findMany({
      where: { assetId: id },
      orderBy: { occurredAt: "asc" },
    });
    expect(events.length).toBeGreaterThanOrEqual(2); // CREATED + AVAILABLE
    expect(events[0].type).toBe("CREATED");
    expect(events[1].type).toBe("AVAILABLE");
  });
});

describe("PATCH /api/assets/{id} — ویرایش", () => {
  it("ویرایش فیلدها + رویداد UPDATED", async () => {
    const created = await createAsset();
    const id = created.body.data.asset.id;

    const res = await api(`/api/assets/${id}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: JSON.stringify({ brand: "Lenovo", model: "ThinkPad T14" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.asset.brand).toBe("Lenovo");

    const ev = await prisma.assetEvent.findFirst({
      where: { assetId: id, type: "UPDATED" },
    });
    expect(ev).not.toBeNull();
  });
});

describe("DELETE /api/assets/{id} — حذف نرم", () => {
  it("retire به جای حذف فیزیکی", async () => {
    const created = await createAsset();
    const id = created.body.data.asset.id;

    const res = await api(`/api/assets/${id}`, { method: "DELETE", cookie: admin.cookie });
    expect(res.status).toBe(200);

    const still = await prisma.asset.findUnique({ where: { id } });
    expect(still).not.toBeNull(); // فیزیکی حذف نشده
    expect(still!.status).toBe("RETIRED");
    expect(still!.retiredAt).not.toBeNull();
  });

  it("بازنشسته دوباره حذف نمی‌شود → 409", async () => {
    const created = await createAsset();
    const id = created.body.data.asset.id;
    await api(`/api/assets/${id}`, { method: "DELETE", cookie: admin.cookie });
    const again = await api(`/api/assets/${id}`, { method: "DELETE", cookie: admin.cookie });
    expect(again.status).toBe(409);
  });
});

describe("RBAC فاز ۲", () => {
  it("employee نمی‌تواند دارایی ببیند (بدون asset:view)", async () => {
    const res = await api("/api/assets", { cookie: employeeCookie });
    expect(res.status).toBe(403);
  });

  it("employee نمی‌تواند ایجاد کند", async () => {
    const res = await api("/api/assets", {
      method: "POST", cookie: employeeCookie,
      body: JSON.stringify({ name: "x", assetTypeId: typeId }),
    });
    expect(res.status).toBe(403);
  });

  it("it_staff می‌تواند ایجاد کند", async () => {
    const res = await api("/api/assets", {
      method: "POST", cookie: itStaffCookie,
      body: JSON.stringify({ name: "دارایی کارشناس IT", assetTypeId: typeId }),
    });
    expect(res.status).toBe(201);
  });

  it("it_staff نمی‌تواند retire کند (بدون asset:retire)", async () => {
    const created = await createAsset();
    const id = created.body.data.asset.id;
    const res = await api(`/api/assets/${id}`, { method: "DELETE", cookie: itStaffCookie });
    expect(res.status).toBe(403);
  });
});
