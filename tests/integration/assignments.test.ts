import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// فاز ۳ — سازمان و تخصیص: employees/departments/locations + assign/return/transfer

let admin: { cookie: string; user: { id: string } };
let itStaffCookie: string;
let employeeCookie: string;
let emp1: { id: string };
let emp2: { id: string };
let assetId: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  admin = await login("admin@ams.local", "Admin@123");
  itStaffCookie = (await login("itstaff@ams.local", "Test@1234")).cookie;
  employeeCookie = (await login("employee@ams.local", "Test@1234")).cookie;

  await prisma.assignment.deleteMany({});
  await prisma.assetEvent.deleteMany({ where: { type: { in: ["ASSIGNED", "RETURNED", "TRANSFERRED"] } } });

  emp1 = (await prisma.employee.findUnique({ where: { personnelCode: "EMP-001" } }))!;
  emp2 = (await prisma.employee.findUnique({ where: { personnelCode: "EMP-002" } }))!;

  // دارایی تستی
  const lap = await prisma.assetType.findUnique({ where: { code: "LAP" } });
  const created = await api("/api/assets", {
    method: "POST", cookie: admin.cookie,
    body: JSON.stringify({ name: "لپ‌تاپ تست تخصیص", assetTypeId: lap!.id }),
  });
  assetId = created.body.data.asset.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("employees API", () => {
  it("لیست کارمندان با شمارش دارایی", async () => {
    const res = await api("/api/employees", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.employees.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data.employees[0]).toHaveProperty("personnelCode");
  });

  it("ایجاد کارمند + کد تکراری 409", async () => {
    const create = await api("/api/employees", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ fullName: "تست کارمند", personnelCode: `T-${Date.now() % 100000}` }),
    });
    expect(create.status).toBe(201);

    const dup = await api("/api/employees", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ fullName: "تکراری", personnelCode: "EMP-001" }),
    });
    expect(dup.status).toBe(409);
  });

  it("employee role نمی‌تواند لیست ببیند → 403", async () => {
    const res = await api("/api/employees", { cookie: employeeCookie });
    expect(res.status).toBe(403);
  });
});

describe("departments & locations", () => {
  it("لیست بخش‌ها (هر کاربر لاگین‌شده)", async () => {
    const res = await api("/api/departments", { cookie: employeeCookie });
    expect(res.status).toBe(200);
    expect(res.body.data.departments.length).toBeGreaterThanOrEqual(6);
  });

  it("ایجاد بخش + نام تکراری 409", async () => {
    const c = await api("/api/departments", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: `بخش تست ${Date.now() % 1000}`, code: null }),
    });
    expect(c.status).toBe(201);
    await prisma.department.delete({ where: { id: c.body.data.department.id } });

    const dup = await api("/api/departments", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: "مالی" }),
    });
    expect(dup.status).toBe(409);
  });

  it("بخش دارای کارمند delete → غیرفعال می‌شود نه حذف", async () => {
    const fin = await prisma.department.findUnique({ where: { code: "FIN" } });
    //EMP-003 رضاست در FIN؟ نه در IT — یک کارمند بگذاریم در مالی
    await prisma.employee.update({ where: { id: emp2.id }, data: { departmentId: fin!.id } });
    const res = await api(`/api/departments/${fin!.id}`, { method: "DELETE", cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.deactivated).toBe(true);
    const still = await prisma.department.findUnique({ where: { id: fin!.id } });
    expect(still).not.toBeNull();
    expect(still!.isActive).toBe(false);
    // rollback برای تست‌های بعدی
    await prisma.department.update({ where: { id: fin!.id }, data: { isActive: true } });
    await prisma.employee.update({ where: { id: emp2.id }, data: { departmentId: null } });
  });

  it("ایجاد محل انبار + درخت (والد)", async () => {
    const c = await api("/api/locations", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: `اتاق تست ${Date.now() % 1000}`, type: "ROOM", parentId: null }),
    });
    expect(c.status).toBe(201);
    await prisma.location.delete({ where: { id: c.body.data.location.id } });
  });
});

describe("assignment lifecycle — قلب فاز ۳", () => {
  it("تحویل موفق: AVAILABLE از IN_STOCK → ASSIGNED", async () => {
    // اول موجود کن
    await api(`/api/assets/${assetId}/status`, {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "AVAILABLE" }),
    });

    const res = await api(`/api/assets/${assetId}/assign`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ employeeId: emp1.id, note: "تحویل اولیه" }),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.assignment.status).toBe("ACTIVE");
    expect(res.body.data.assignment.employee.fullName).toBe("علی رضایی");

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(asset!.status).toBe("ASSIGNED");
    expect(asset!.holderEmployeeId).toBe(emp1.id);
  });

  it("تحویل مجدد همان دارایی → 409 ASSET_ALREADY_ASSIGNED", async () => {
    const res = await api(`/api/assets/${assetId}/assign`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ employeeId: emp2.id }),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ASSET_ALREADY_ASSIGNED");
  });

  it("انتقال: بستن قبلی + تحویل جدید + رویداد TRANSFERRED", async () => {
    const res = await api(`/api/assets/${assetId}/transfer`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ toEmployeeId: emp2.id, note: "انتقال تست" }),
    });
    expect(res.status).toBe(200);

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(asset!.holderEmployeeId).toBe(emp2.id);
    expect(asset!.lifecycleStage).toBe("TRANSFERRED");

    // یک ACTIVE و یک RETURNED
    const assignments = await prisma.assignment.findMany({
      where: { assetId },
      orderBy: { assignedAt: "asc" },
    });
    expect(assignments.length).toBe(2);
    expect(assignments[0].status).toBe("RETURNED");
    expect(assignments[1].status).toBe("ACTIVE");

    const ev = await prisma.assetEvent.findFirst({
      where: { assetId, type: "TRANSFERRED" },
    });
    expect(ev).not.toBeNull();
    expect(ev!.fromEmployeeId).toBe(emp1.id);
    expect(ev!.toEmployeeId).toBe(emp2.id);
  });

  it("انتقال به خودِ نگهدارنده → 409 SAME_EMPLOYEE", async () => {
    const res = await api(`/api/assets/${assetId}/transfer`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ toEmployeeId: emp2.id }),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SAME_EMPLOYEE");
  });

  it("عودت با ثبت وضع ظاهری → AVAILABLE و holder خالی", async () => {
    const res = await api(`/api/assets/${assetId}/return`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ toStatus: "IN_STOCK", condition: "FAIR", note: "عودت به انبار" }),
    });
    expect(res.status).toBe(200);

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(asset!.status).toBe("IN_STOCK");
    expect(asset!.holderEmployeeId).toBeNull();
    expect(asset!.condition).toBe("FAIR");

    const active = await prisma.assignment.count({ where: { assetId, status: "ACTIVE" } });
    expect(active).toBe(0);
  });

  it("عودت داراییِ تحویل‌نشده → 409 NOT_ASSIGNED", async () => {
    const res = await api(`/api/assets/${assetId}/return`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ toStatus: "AVAILABLE" }),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOT_ASSIGNED");
  });

  it("رویدادهای کامل در تاریخچه: ASSIGNED → TRANSFERRED → RETURNED", async () => {
    const events = await prisma.assetEvent.findMany({
      where: { assetId },
      orderBy: { occurredAt: "asc" },
    });
    const types = events.map((e) => e.type);
    expect(types).toContain("ASSIGNED");
    expect(types).toContain("TRANSFERRED");
    expect(types).toContain("RETURNED");
  });
});

describe("RBAC فاز ۳", () => {
  it("it_staff می‌تواند تحویل دهد (asset:assign دارد)", async () => {
    await api(`/api/assets/${assetId}/status`, {
      method: "POST", cookie: admin.cookie, body: JSON.stringify({ to: "AVAILABLE" }),
    });
    const res = await api(`/api/assets/${assetId}/assign`, {
      method: "POST", cookie: itStaffCookie,
      body: JSON.stringify({ employeeId: emp1.id }),
    });
    expect(res.status).toBe(201);
    // cleanup
    await api(`/api/assets/${assetId}/return`, {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ toStatus: "IN_STOCK" }),
    });
  });

  it("employee role نمی‌تواند تحویل دهد → 403", async () => {
    const res = await api(`/api/assets/${assetId}/assign`, {
      method: "POST", cookie: employeeCookie,
      body: JSON.stringify({ employeeId: emp1.id }),
    });
    expect(res.status).toBe(403);
  });

  it("my-assets برای employee لینک‌شده → hasEmployee: true (seed فاز ۷)", async () => {
    const res = await api("/api/my-assets", { cookie: employeeCookie });
    expect(res.status).toBe(200);
    expect(res.body.data.hasEmployee).toBe(true);
  });
});
