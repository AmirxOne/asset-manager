import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

let admin: { cookie: string };
let employeeCookie: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  admin = await login("admin@ams.local", "Admin@123");
  employeeCookie = (await login("employee@ams.local", "Test@1234")).cookie;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("categories API", () => {
  it("GET لیست دسته‌ها (هر کاربر لاگین‌شده)", async () => {
    const res = await api("/api/categories", { cookie: employeeCookie });
    expect(res.status).toBe(200);
    expect(res.body.data.categories.length).toBeGreaterThanOrEqual(6);
  });

  it("ایجاد دسته جدید + کد تکراری 409", async () => {
    const create = await api("/api/categories", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: "تست دسته", code: "TST" }),
    });
    expect(create.status).toBe(201);

    const dup = await api("/api/categories", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: "تکراری", code: "TST" }),
    });
    expect(dup.status).toBe(409);

    // cleanup
    await prisma.assetCategory.deleteMany({ where: { code: "TST" } });
  });

  it("کد غیرمجاز → 400", async () => {
    const res = await api("/api/categories", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: "خراب", code: "کد-فارسی" }),
    });
    expect(res.status).toBe(400);
  });

  it("دسته دارای نوع حذف نمی‌شود → 409", async () => {
    const it = await prisma.assetCategory.findUnique({ where: { code: "IT" } });
    const res = await api(`/api/categories/${it!.id}`, { method: "DELETE", cookie: admin.cookie });
    expect(res.status).toBe(409);
  });

  it("employee نمی‌تواند دسته بسازد → 403", async () => {
    const res = await api("/api/categories", {
      method: "POST", cookie: employeeCookie,
      body: JSON.stringify({ name: "نفوذ", code: "HCK" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("asset-types API", () => {
  it("ایجاد نوع جدید در دسته", async () => {
    const cat = await prisma.assetCategory.findUnique({ where: { code: "IT" } });
    const res = await api("/api/asset-types", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: "دوکینگ استیشن", code: "DCK", categoryId: cat!.id }),
    });
    expect(res.status).toBe(201);
    await prisma.assetType.deleteMany({ where: { code: "DCK" } });
  });

  it("دسته نامعتبر → 404", async () => {
    const res = await api("/api/asset-types", {
      method: "POST", cookie: admin.cookie,
      body: JSON.stringify({ name: "بی‌دسته", code: "NOP", categoryId: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });
});
