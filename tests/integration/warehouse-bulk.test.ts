import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// فاز ۴ — انبار و عملیات گروهی

let admin: { cookie: string };
let whMgrCookie: string;
let employeeCookie: string;
let emp: { id: string };
let assetIds: string[] = [];

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  admin = await login("admin@ams.local", "Admin@123");
  whMgrCookie = (await login("whmgr@ams.local", "Test@1234")).cookie;
  employeeCookie = (await login("employee@ams.local", "Test@1234")).cookie;

  await prisma.assignment.deleteMany({});
  emp = (await prisma.employee.findUnique({ where: { personnelCode: "EMP-001" } }))!;

  // سه دارایی تستی
  const lap = await prisma.assetType.findUnique({ where: { code: "LAP" } });
  for (let i = 0; i < 3; i++) {
    const res = await api("/api/assets", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: `دارایی گروهی ${i + 1}`, assetTypeId: lap!.id }),
    });
    assetIds.push(res.body.data.asset.id);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/warehouse/summary", () => {
  it("شمارش‌ها و ارزش کل درست است", async () => {
    const res = await api("/api/warehouse/summary", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    const s = res.body.data.summary;

    const totalInDb = await prisma.asset.count({ where: { isDeleted: false } });
    expect(s.total).toBe(totalInDb);
    expect(s.status.IN_STOCK).toBeGreaterThanOrEqual(3);

    // جمع status برابر total
    const sumStatus = Object.values(s.status).reduce((a: number, b: unknown) => a + Number(b), 0);
    expect(sumStatus).toBe(s.total);
  });

  it("مدیر انبار می‌بیند (asset:view دارد)", async () => {
    const res = await api("/api/warehouse/summary", { cookie: whMgrCookie });
    expect(res.status).toBe(200);
  });

  it("employee نمی‌بیند → 403", async () => {
    const res = await api("/api/warehouse/summary", { cookie: employeeCookie });
    expect(res.status).toBe(403);
  });
});

describe("stock-in / stock-out", () => {
  it("چرخه: IN_STOCK → (out) AVAILABLE → (in) IN_STOCK", async () => {
    const id = assetIds[0];

    const out = await api("/api/warehouse/stock-out", {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ assetId: id }),
    });
    expect(out.status).toBe(200);
    expect(out.body.data.asset.status).toBe("AVAILABLE");

    const back = await api("/api/warehouse/stock-in", {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ assetId: id }),
    });
    expect(back.status).toBe(200);
    expect(back.body.data.asset.status).toBe("IN_STOCK");

    const events = await prisma.assetEvent.findMany({
      where: { assetId: id, type: { in: ["IN_STOCK", "AVAILABLE"] } },
    });
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it("stock-out روی دارایی AVAILABLE → 409", async () => {
    const id = assetIds[0];
    await api("/api/warehouse/stock-out", {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ assetId: id }),
    });
    const again = await api("/api/warehouse/stock-out", {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ assetId: id }),
    });
    expect(again.status).toBe(409);
    // برگرداندن
    await api("/api/warehouse/stock-in", {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ assetId: id }),
    });
  });

  it("it_staff بدون warehouse:manage نمی‌تواند → 403", async () => {
    const itCookie = (await login("itstaff@ams.local", "Test@1234")).cookie;
    const res = await api("/api/warehouse/stock-out", {
      method: "POST", cookie: itCookie, body: JSON.stringify({ assetId: assetIds[0] }),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/assets/bulk", () => {
  it("تغییر وضعیت گروهی: ۳ دارایی → AVAILABLE", async () => {
    const res = await api("/api/assets/bulk", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ action: "STATUS", ids: assetIds, to: "AVAILABLE" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(3);
    expect(res.body.data.failed).toBe(0);
  });

  it("گزارش per-item: گذار غیرمجاز رد می‌شود ولی بقیه انجام می‌شوند", async () => {
    // یکی را RETIRED کن → گذارش به ASSIGNED نامعتبر
    await api(`/api/assets/${assetIds[2]}/status`, {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "RETIRED" }),
    });

    const res = await api("/api/assets/bulk", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ action: "ASSIGN", ids: assetIds, employeeId: emp.id }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(2); // دو تا AVAILABLE تحویل شدند
    expect(res.body.data.failed).toBe(1); // بازنشسته رد شد

    const failedItem = res.body.data.results.find((r: { ok: boolean }) => !r.ok);
    expect(failedItem.error).toContain("مجاز نیست");
  });

  it("ویرایش گروهی condition", async () => {
    // اول عودت دو تای تحویل‌شده
    for (const id of assetIds.slice(0, 2)) {
      await api(`/api/assets/${id}/return`, {
        method: "POST", cookie: admin.cookie,
        body: JSON.stringify({ toStatus: "AVAILABLE" }),
      });
    }
    const res = await api("/api/assets/bulk", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ action: "UPDATE", ids: assetIds.slice(0, 2), patch: { condition: "FAIR" } }),
    });
    expect(res.body.data.succeeded).toBe(2);
    const assets = await prisma.asset.findMany({ where: { id: { in: assetIds.slice(0, 2) } } });
    for (const a of assets) expect(a.condition).toBe("FAIR");
  });

  it("employee → 403", async () => {
    const res = await api("/api/assets/bulk", {
      method: "POST", cookie: employeeCookie,
      body: JSON.stringify({ action: "STATUS", ids: [assetIds[0]], to: "AVAILABLE" }),
    });
    expect(res.status).toBe(403);
  });

  it("بدون ids → 400", async () => {
    const res = await api("/api/assets/bulk", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ action: "STATUS", ids: [], to: "AVAILABLE" }),
    });
    expect(res.status).toBe(400);
  });
});
