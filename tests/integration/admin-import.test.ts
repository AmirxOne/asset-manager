import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// تکمیل نهایی — admin users + import CSV

let admin: { cookie: string };
let empCk: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  admin = await login("admin@ams.local", "Admin@123");
  empCk = (await login("employee@ams.local", "Test@1234")).cookie;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("admin users", () => {
  it("لیست کاربران با نقش‌ها", async () => {
    const res = await api("/api/admin/users", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(7); // admin + 6
    const withRoles = res.body.data.users.filter(
      (u: { roles: unknown[] }) => u.roles.length > 0,
    );
    expect(withRoles.length).toBeGreaterThan(0);
  });

  it("ایجاد + غیرفعال‌سازی + خودمحافظتی", async () => {
    const email = `imp-${Date.now() % 100000}@test.local`;
    const c = await api("/api/admin/users", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ fullName: "کاربر تست ادمین", email, password: "Pass@12345", roleKeys: ["it_staff"] }),
    });
    expect(c.status).toBe(201);

    // تکراری
    const dup = await api("/api/admin/users", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ fullName: "تکراری", email, password: "Pass@12345", roleKeys: ["it_staff"] }),
    });
    expect(dup.status).toBe(409);

    // غیرفعال کردن خودش → 409
    const me = await api("/api/auth/me", { cookie: admin.cookie });
    const selfOff = await api(`/api/admin/users/${me.body.data.user.id}`, {
      method: "PATCH", cookie: admin.cookie, body: JSON.stringify({ isActive: false }),
    });
    expect(selfOff.status).toBe(409);
    expect(selfOff.body.error.code).toBe("FORBIDDEN_SELF");
  });

  it("employee نمی‌تواند → 403", async () => {
    const res = await api("/api/admin/users", { cookie: empCk });
    expect(res.status).toBe(403);
  });
});

describe("admin roles", () => {
  it("ماتریس نقش‌ها + همه مجوزها", async () => {
    const res = await api("/api/admin/roles", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.roles.length).toBe(7);
    expect(res.body.data.permissions.length).toBeGreaterThanOrEqual(33);
  });
});

describe("import CSV — دو مرحله‌ای", () => {
  const run = Date.now() % 100000;
  const csv = [
    "name,typeCode,brand,serialNumber,purchaseDate,purchasePrice",
    `لپ‌تاپ ایمپورت ${run},LAP,Dell,IMP-${run}-1,2026-01-15,45000000`,
    `موس ایمپورت ${run},MOU,Logitech,IMP-${run}-2,2026-02-01,850000`,
    `ردیف خراب ${run},XXXX,HP,IMP-${run}-3,2026-03-01,100`,  // نوع نامعتبر
    `بدون نام ${run},LAP,,,not-a-date,100`, // تاریخ خراب
  ].join("\n");

  it("dryRun: ۲ معتبر + ۲ خطا", async () => {
    const res = await api("/api/assets/import?dryRun=1", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ csv }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.dryRun).toBe(true);
    expect(res.body.data.summary.total).toBe(4);
    expect(res.body.data.summary.valid).toBe(2);
    expect(res.body.data.summary.errors).toBe(2);
  });

  it("ایجاد واقعی: کدهای AST خودکار", async () => {
    const res = await api("/api/assets/import", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ csv }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.summary.created).toBe(2);
    expect(res.body.data.created.length).toBe(2);
    expect(res.body.data.created[0]).toMatch(/^AST-/);

    // در DB با رویداد CREATED
    const one = await prisma.asset.findUnique({ where: { code: res.body.data.created[0] } });
    expect(one).not.toBeNull();
    const ev = await prisma.assetEvent.findFirst({
      where: { assetId: one!.id, type: "CREATED", note: "ورود گروهی از CSV" },
    });
    expect(ev).not.toBeNull();
  });

  it("سریال تکراری در اجرای دوم → خطا", async () => {
    const res = await api("/api/assets/import?dryRun=1", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ csv: `name,typeCode,serialNumber\nدوباره,LAP,IMP-${run}-1` }),
    });
    expect(res.body.data.summary.valid).toBe(0);
    expect(res.body.data.summary.errors).toBe(1);
    expect(JSON.stringify(res.body.data.report[0].errors)).toContain("تکراری");
  });

  it("employee نمی‌تواند import کند → 403", async () => {
    const res = await api("/api/assets/import?dryRun=1", {
      method: "POST", cookie: empCk,
      body: JSON.stringify({ csv: "name,typeCode\nx,LAP" }),
    });
    expect(res.status).toBe(403);
  });
});
