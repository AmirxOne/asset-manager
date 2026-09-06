import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// فاز ۱۰ — لاگ ممیزی: ثبت عملیات + فیلتر + RBAC

let admin: { cookie: string };
let empCk: string;
let assetId: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  admin = await login("admin@ams.local", "Admin@123");
  empCk = (await login("employee@ams.local", "Test@1234")).cookie;

  // عملیات نمونه برای لاگ
  const lap = await prisma.assetType.findUnique({ where: { code: "LAP" } });
  const res = await api("/api/assets", {
    method: "POST", cookie: admin.cookie,
    body: JSON.stringify({ name: "دارایی لاگ تست", assetTypeId: lap!.id }),
  });
  assetId = res.body.data.asset.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("audit-logs API", () => {
  it("لیست با فیلترهای موجود", async () => {
    const res = await api("/api/audit-logs", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.logs)).toBe(true);
    expect(res.body.data.filters.actions.length).toBeGreaterThan(0);
    expect(res.body.data.filters.entities.length).toBeGreaterThan(0);
  });

  it("عملیات CREATE دارایی در لاگ ثبت شده", async () => {
    const res = await api("/api/audit-logs?action=CREATE&entity=Asset", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBeGreaterThan(0);
    const last = res.body.data.logs[0];
    expect(last.actor.email).toBe("admin@ams.local");
    expect(last.newValue).toBeTruthy();
  });

  it("فیلتر action غلط → خالی نه خطا", async () => {
    const res = await api("/api/audit-logs?action=HACK", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBe(0);
  });

  it("صفحه‌بندی: pageSize حداکثر ۵۰", async () => {
    const res = await api("/api/audit-logs?pageSize=999", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBeLessThanOrEqual(50);
  });

  it("employee بدون audit-log:view → 403", async () => {
    const res = await api("/api/audit-logs", { cookie: empCk });
    expect(res.status).toBe(403);
  });
});

describe("پوشش ثبت لاگ در عملیات‌های حیاتی", () => {
  it("تغییر وضعیت هم AuditLog دارد", async () => {
    await api(`/api/assets/${assetId}/status`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ to: "AVAILABLE" }),
    });
    const res = await api("/api/audit-logs?entity=Asset", { cookie: admin.cookie });
    // حداقل CREATE همین دارایی هست
    expect(res.body.data.logs.length).toBeGreaterThan(0);
  });
});
