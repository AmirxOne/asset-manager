import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// فاز ۹ — داشبورد و گزارش‌ها + Export

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

describe("داشبورد", () => {
  it("آمار کامل + رویدادها + درخواست‌ها", async () => {
    const res = await api("/api/dashboard", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.stats).toHaveProperty("total");
    expect(d.stats).toHaveProperty("status");
    expect(d.stats).toHaveProperty("totalValue");
    expect(Array.isArray(d.recentEvents)).toBe(true);
    expect(Array.isArray(d.openRequests)).toBe(true);
    // جمع status = total
    const sum = Object.values(d.stats.status).reduce((a: number, b: unknown) => a + Number(b), 0);
    expect(sum).toBe(d.stats.total);
  });

  it("employee بدون dashboard:view → 403", async () => {
    const res = await api("/api/dashboard", { cookie: empCk });
    expect(res.status).toBe(403);
  });
});

describe("گزارش‌ها — همه ۱۴ نوع", () => {
  const types = [
    "by_category", "by_department", "by_employee", "by_location", "by_status",
    "by_condition", "by_supplier", "maintenance_cost", "lost", "retired",
    "warranty_expiration", "asset_value", "inventory_audit", "employee_assets",
  ];

  it("همه انواع سطر و ستون برمی‌گردانند", async () => {
    for (const t of types) {
      const res = await api(`/api/reports?type=${t}`, { cookie: admin.cookie });
      expect(res.status, `report ${t}`).toBe(200);
      expect(Array.isArray(res.body.data.columns)).toBe(true);
      expect(Array.isArray(res.body.data.rows)).toBe(true);
    }
  });

  it("گزارش نامعتبر → 404", async () => {
    const res = await api("/api/reports?type=nonexistent", { cookie: admin.cookie });
    expect(res.status).toBe(404);
  });

  it("by_status: جمع سطرها = کل دارایی‌ها", async () => {
    const res = await api("/api/reports?type=by_status", { cookie: admin.cookie });
    const total = res.body.data.rows.reduce((a: number, r: { count: number }) => a + Number(r.count), 0);
    const dbTotal = await prisma.asset.count({ where: { isDeleted: false } });
    expect(total).toBe(dbTotal);
  });
});

describe("Export", () => {
  it("CSV فارسی با هدر دانلود", async () => {
    const res = await fetch("http://localhost:3200/api/reports?type=by_status&format=csv", {
      headers: { Cookie: admin.cookie },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("report-by_status.csv");
    const text = await res.text();
    expect(text).toContain("تعداد");
    expect(text).toContain("IN_STOCK");
  });

  it("اکسل (.xls HTML)", async () => {
    const res = await fetch("http://localhost:3200/api/reports?type=by_category&format=xlsx", {
      headers: { Cookie: admin.cookie },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/vnd.ms-excel");
    const text = await res.text();
    expect(text).toContain("<table");
  });

  it("PDF = صفحه چاپی با پنجره چاپ", async () => {
    const res = await fetch("http://localhost:3200/api/reports?type=lost&format=pdf", {
      headers: { Cookie: admin.cookie },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("print()");
  });

  it("employee بدون report:view → 403 (نمایش و خروجی)", async () => {
    // employee نه view دارد نه export
    const view = await api("/api/reports?type=by_status", { cookie: empCk });
    expect(view.status).toBe(403);
    const exp = await fetch("http://localhost:3200/api/reports?type=by_status&format=csv", {
      headers: { Cookie: empCk },
    });
    expect(exp.status).toBe(403);
  });
});
