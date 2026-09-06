import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// فاز ۷ — گردش درخواست: ثبت → تأیید مدیر → تأیید IT → تأمین

let employeeCk: string;   // کارمند (درخواست‌دهنده) — EMP-001 لینک‌شده
let deptMgrCk: string;    // مدیر بخش — EMP-003 لینک‌شده
let itMgrCk: string;      // مدیر IT (تأیید IT + تأمین)
let adminCk: string;
let emp1Id: string;       // EMP-001
let requestId: string;
let assetId: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  employeeCk = (await login("employee@ams.local", "Test@1234")).cookie;
  deptMgrCk = (await login("deptmgr@ams.local", "Test@1234")).cookie;
  itMgrCk = (await login("itmgr@ams.local", "Test@1234")).cookie;
  adminCk = (await login("admin@ams.local", "Admin@123")).cookie;

  await prisma.assetRequest.deleteMany({});
  await prisma.notification.deleteMany({});

  emp1Id = (await prisma.employee.findUnique({ where: { personnelCode: "EMP-001" } }))!.id;

  // دارایی برای تأمین — AVAILABLE
  const lap = await prisma.assetType.findUnique({ where: { code: "LAP" } });
  const created = await api("/api/assets", {
    method: "POST", cookie: adminCk,
    body: JSON.stringify({ name: "لپ‌تاپ تأمین درخواست", assetTypeId: lap!.id }),
  });
  assetId = created.body.data.asset.id;
  await api(`/api/assets/${assetId}/status`, {
    method: "POST", cookie: adminCk, body: JSON.stringify({ to: "AVAILABLE" }),
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("گردش کامل درخواست", () => {
  it("۱) کارمند درخواست می‌سازد — کد REQ-{سال}-{۴رقم}", async () => {
    const res = await api("/api/requests", {
      method: "POST", cookie: employeeCk,
      body: JSON.stringify({ title: "لپ‌تاپ برای پروژه جدید", quantity: 1, urgency: "HIGH" }),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.request.code).toMatch(/^REQ-\d{4}-\d{4}$/);
    expect(res.body.data.request.status).toBe("PENDING");
    requestId = res.body.data.request.id;
  });

  it("۲) مدیر بخش تأیید می‌کند → MANAGER_APPROVED", async () => {
    const res = await api(`/api/requests/${requestId}/approve`, {
      method: "POST", cookie: deptMgrCk,
      body: JSON.stringify({ action: "DECIDE", decision: "APPROVED" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("MANAGER_APPROVED");
  });

  it("۳) تأیید IT → IT_APPROVED", async () => {
    const res = await api(`/api/requests/${requestId}/approve`, {
      method: "POST", cookie: itMgrCk,
      body: JSON.stringify({ action: "DECIDE", decision: "APPROVED" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("IT_APPROVED");
  });

  it("۴) تأمین — دارایی خودکار تحویل می‌شود + FULFILLED", async () => {
    const res = await api(`/api/requests/${requestId}/approve`, {
      method: "POST", cookie: itMgrCk,
      body: JSON.stringify({ action: "FULFILL", assetIds: [assetId] }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.fulfilled).toBe(1);

    // دارایی به درخواست‌دهنده تحویل شده
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(asset!.status).toBe("ASSIGNED");
    expect(asset!.holderEmployeeId).toBe(emp1Id);

    const req = await prisma.assetRequest.findUnique({ where: { id: requestId } });
    expect(req!.status).toBe("FULFILLED");
    expect(req!.fulfilledAt).not.toBeNull();
  });

  it("۵) اعلان‌ها: درخواست‌دهنده FULFILLED گرفته", async () => {
    const empUser = await prisma.user.findUnique({ where: { email: "employee@ams.local" } });
    const notif = await prisma.notification.findFirst({
      where: { userId: empUser!.id, type: "REQUEST_FULFILLED" },
    });
    expect(notif).not.toBeNull();
  });
});

describe("خطاها و RBAC", () => {
  it("تأمین بدون تأیید IT → 409 NOT_APPROVED", async () => {
    const res = await api("/api/requests", {
      method: "POST", cookie: employeeCk,
      body: JSON.stringify({ title: "درخواست دوم" }),
    });
    const id = res.body.data.request.id; // PENDING
    const ful = await api(`/api/requests/${id}/approve`, {
      method: "POST", cookie: itMgrCk,
      body: JSON.stringify({ action: "FULFILL", assetIds: [assetId] }),
    });
    expect(ful.status).toBe(409);
    expect(ful.body.error.code).toBe("NOT_APPROVED");
  });

  it("IT نمی‌تواند مرحله مدیر را تأیید کند → 403 (perm دارد اما stage غلط)", async () => {
    const res = await api("/api/requests", {
      method: "POST", cookie: employeeCk,
      body: JSON.stringify({ title: "درخواست سوم" }),
    });
    const id = res.body.data.request.id;
    // itmgr هم request:approve:it دارد و هم؟ نه manager ندارد → باید 403 بگیرد
    const dec = await api(`/api/requests/${id}/approve`, {
      method: "POST", cookie: itMgrCk,
      body: JSON.stringify({ action: "DECIDE", decision: "APPROVED" }),
    });
    expect(dec.status).toBe(403);
  });

  it("کارمند نمی‌تواند تأیید کند → 403", async () => {
    const res = await api("/api/requests", {
      method: "POST", cookie: employeeCk,
      body: JSON.stringify({ title: "درخواست چهارم" }),
    });
    const id = res.body.data.request.id;
    const dec = await api(`/api/requests/${id}/approve`, {
      method: "POST", cookie: employeeCk,
      body: JSON.stringify({ action: "DECIDE", decision: "APPROVED" }),
    });
    expect(dec.status).toBe(403);
  });

  it("لغو توسط درخواست‌دهنده — فقط خودش", async () => {
    const res = await api("/api/requests", {
      method: "POST", cookie: employeeCk,
      body: JSON.stringify({ title: "درخواست لغوشدنی" }),
    });
    const id = res.body.data.request.id;

    // مدیر بخش نمی‌تواند لغو کند (درخواست‌دهنده نیست)
    const byOther = await api(`/api/requests/${id}/approve`, {
      method: "POST", cookie: deptMgrCk,
      body: JSON.stringify({ action: "CANCEL" }),
    });
    expect(byOther.status).toBe(403);

    const bySelf = await api(`/api/requests/${id}/approve`, {
      method: "POST", cookie: employeeCk,
      body: JSON.stringify({ action: "CANCEL" }),
    });
    expect(bySelf.status).toBe(200);
  });

  it("رد در مرحله مدیر → REJECTED و بسته", async () => {
    const res = await api("/api/requests", {
      method: "POST", cookie: employeeCk,
      body: JSON.stringify({ title: "درخواست رد‌شونده" }),
    });
    const id = res.body.data.request.id;
    await api(`/api/requests/${id}/approve`, {
      method: "POST", cookie: deptMgrCk,
      body: JSON.stringify({ action: "DECIDE", decision: "REJECTED", note: "بودجه نیست" }),
    });
    const again = await api(`/api/requests/${id}/approve`, {
      method: "POST", cookie: itMgrCk,
      body: JSON.stringify({ action: "DECIDE", decision: "APPROVED" }),
    });
    expect(again.status).toBe(409);
  });

  it("scope=mine فقط خودم — viewAll برای admin", async () => {
    const mine = await api("/api/requests?scope=mine", { cookie: employeeCk });
    expect(mine.body.data.requests.length).toBeGreaterThanOrEqual(4); // آنهایی که کارمند ساخت

    const all = await api("/api/requests?scope=all", { cookie: adminCk });
    expect(all.body.data.viewAll).toBe(true);
    expect(all.body.data.requests.length).toBeGreaterThanOrEqual(mine.body.data.requests.length);
  });
});

describe("notifications API", () => {
  it("لیست + خواندن همه", async () => {
    const empUser = await prisma.user.findUnique({ where: { email: "employee@ams.local" } });
    await prisma.notification.create({
      data: { userId: empUser!.id, type: "TEST", title: "تست اعلان" },
    });
    const list = await api("/api/notifications", { cookie: employeeCk });
    expect(list.status).toBe(200);
    expect(list.body.data.notifications.length).toBeGreaterThan(0);
    expect(list.body.data.unreadCount).toBeGreaterThan(0);

    await api("/api/notifications", { method: "POST", cookie: employeeCk });
    const after = await api("/api/notifications", { cookie: employeeCk });
    expect(after.body.data.unreadCount).toBe(0);
  });
});
