import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// فاز ۸ — ممیزی موجودی: snapshot → scan (match/mismatch/unexpected/duplicate) → close

let admin: { cookie: string };
let whCk: string;   // whmgr: audit:scan دارد
let empCk: string;
let sessionId: string;
let codes: string[] = [];
let mismatchAssetId: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  admin = await login("admin@ams.local", "Admin@123");
  whCk = (await login("whmgr@ams.local", "Test@1234")).cookie;
  empCk = (await login("employee@ams.local", "Test@1234")).cookie;

  await prisma.auditScan.deleteMany({});
  await prisma.auditSession.deleteMany({});

  // سه دارایی IN_STOCK
  const kbd = await prisma.assetType.findUnique({ where: { code: "KBD" } });
  for (let i = 0; i < 3; i++) {
    const res = await api("/api/assets", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: `ممیزی ${i + 1}`, assetTypeId: kbd!.id }),
    });
    codes.push(res.body.data.asset.code);
    if (i === 2) mismatchAssetId = res.body.data.asset.id;
  }

  // ممیزی قبل از تغییر وضعیت ساخته می‌شود (snapshot = IN_STOCK)
  const aud = await api("/api/audits", {
    method: "POST", cookie: admin.cookie,
    body: JSON.stringify({ title: "شمارش تست", scope: "ALL" }),
  });
  sessionId = aud.body.data.audit.id;

  // حالا وضعیت دارایی سوم عوض می‌شود → MISMATCH در اسکن
  await api(`/api/assets/${mismatchAssetId}/status`, {
    method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "AVAILABLE" }),
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("چرخه ممیزی", () => {
  it("۱) ایجاد ممیزی — snapshot با کد انتظار", async () => {
    const session = await prisma.auditSession.findUnique({ where: { id: sessionId } });
    expect(session!.code).toMatch(/^AUD-\d{4}-\d{4}$/);
    expect(session!.status).toBe("OPEN");
    expect(session!.expectedTotal).toBeGreaterThanOrEqual(3);
  });

  it("۲) اسکن مطابق → MATCH", async () => {
    const res = await api(`/api/audits/${sessionId}/scan`, {
      method: "POST", cookie: whCk,
      body: JSON.stringify({ code: codes[0] }),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.result).toBe("MATCH");
  });

  it("۳) اسکن با URL کامل QR هم کار می‌کند", async () => {
    const res = await api(`/api/audits/${sessionId}/scan`, {
      method: "POST", cookie: whCk,
      body: JSON.stringify({ code: `http://localhost:3200/a/${codes[1]}` }),
    });
    expect(res.body.data.result).toBe("MATCH");
  });

  it("۴) وضعیت عوض‌شده → MISMATCH با expected/found", async () => {
    const res = await api(`/api/audits/${sessionId}/scan`, {
      method: "POST", cookie: whCk,
      body: JSON.stringify({ code: codes[2] }),
    });
    expect(res.body.data.result).toBe("MISMATCH");
    expect(res.body.data.scan.expectedStatus).toBe("IN_STOCK");
    expect(res.body.data.scan.foundStatus).toBe("AVAILABLE");
  });

  it("۵) اسکن تکراری → DUPLICATE (نه رکورد جدید)", async () => {
    const before = await prisma.auditScan.count({ where: { sessionId } });
    const res = await api(`/api/audits/${sessionId}/scan`, {
      method: "POST", cookie: whCk,
      body: JSON.stringify({ code: codes[0] }),
    });
    expect(res.body.data.result).toBe("DUPLICATE");
    const after = await prisma.auditScan.count({ where: { sessionId } });
    expect(after).toBe(before);
  });

  it("۶) کد ناشناخته → UNEXPECTED", async () => {
    const res = await api(`/api/audits/${sessionId}/scan`, {
      method: "POST", cookie: whCk,
      body: JSON.stringify({ code: "AST-XX-YYY-999999" }),
    });
    expect(res.body.data.result).toBe("UNEXPECTED");
  });

  it("۷) پیشرفت: شمارنده‌ها درست", async () => {
    const res = await api(`/api/audits/${sessionId}`, { cookie: admin.cookie });
    const c = res.body.data.counts;
    expect(c.scanned).toBe(4);
    expect(c.match).toBe(2);
    expect(c.mismatch).toBe(1);
    expect(c.unexpected).toBe(1);
    expect(c.missing).toBeGreaterThanOrEqual(1); // بقیه دارایی‌های seed
  });

  it("۸) بستن — گزارش نهایی + رویداد مفقودی", async () => {
    const missingBefore = await prisma.assetEvent.count({ where: { type: "AUDIT" } });
    const res = await api(`/api/audits/${sessionId}/close`, {
      method: "POST", cookie: admin.cookie,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.closed).toBe(true);
    expect(res.body.data.counts.missing).toBeGreaterThanOrEqual(1);

    // رویداد مفقودی برای دارایی‌های scan‌نشده
    const missingAfter = await prisma.assetEvent.count({ where: { type: "AUDIT" } });
    expect(missingAfter).toBeGreaterThan(missingBefore);

    // نشست بسته
    const session = await prisma.auditSession.findUnique({ where: { id: sessionId } });
    expect(session!.status).toBe("CLOSED");
    expect(session!.report).toHaveProperty("final");
  });

  it("۹) اسکن روی نشست بسته → 409", async () => {
    const res = await api(`/api/audits/${sessionId}/scan`, {
      method: "POST", cookie: whCk,
      body: JSON.stringify({ code: codes[0] }),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("AUDIT_CLOSED");
  });
});

describe("RBAC", () => {
  it("employee نمی‌تواند ممیزی ببیند → 403", async () => {
    const res = await api("/api/audits", { cookie: empCk });
    expect(res.status).toBe(403);
  });

  it("whmgr (audit:manage) می‌تواند نشست بسازد — itstaff نه → 403", async () => {
    const view = await api("/api/audits", { cookie: whCk });
    expect(view.status).toBe(200);
    // it_staff فقط audit:view دارد
    const itsCk = (await login("itstaff@ams.local", "Test@1234")).cookie;
    const create = await api("/api/audits", {
      method: "POST", cookie: itsCk,
      body: JSON.stringify({ title: "نفوذ" }),
    });
    expect(create.status).toBe(403);
    // و نمی‌تواند اسکن کند
    const scan = await api(`/api/audits/${sessionId}/scan`, {
      method: "POST", cookie: itsCk,
      body: JSON.stringify({ code: codes[0] }),
    });
    expect(scan.status).toBe(403);
  });
});
