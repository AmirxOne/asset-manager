import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma, login, api } from "./helpers";

// فاز ۵ — QR/بارکد/برچسب/ریدایرکت

let admin: { cookie: string };
let employeeCookie: string;
let assetId: string;
let assetCode: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  admin = await login("admin@ams.local", "Admin@123");
  employeeCookie = (await login("employee@ams.local", "Test@1234")).cookie;

  const lap = await prisma.assetType.findUnique({ where: { code: "LAP" } });
  const res = await api("/api/assets", {
    method: "POST", cookie: admin.cookie,
    body: JSON.stringify({ name: "دارایی تست QR", assetTypeId: lap!.id }),
  });
  assetId = res.body.data.asset.id;
  assetCode = res.body.data.asset.code;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/assets/{id}/qr", () => {
  it("SVG معتبر با محتوای /a/{code}", async () => {
    const res = await fetch(`http://localhost:3200/api/assets/${assetId}/qr`, {
      headers: { Cookie: admin.cookie },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    const svg = await res.text();
    expect(svg).toMatch(/^<svg/);

    // تاریخچه اولین تولید
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(asset!.qrGeneratedAt).not.toBeNull();
  });

  it("بدون لاگین → 401", async () => {
    const res = await fetch(`http://localhost:3200/api/assets/${assetId}/qr`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/assets/{id}/barcode", () => {
  it("SVG Code39 با متن کد", async () => {
    const res = await fetch(`http://localhost:3200/api/assets/${assetId}/barcode`, {
      headers: { Cookie: admin.cookie },
    });
    expect(res.status).toBe(200);
    const svg = await res.text();
    expect(svg).toContain(`>${assetCode}</text>`);
  });
});

describe("GET /a/{code} — ریدایرکت QR", () => {
  it("کد معتبر → 307 به /assets/{id}", async () => {
    const res = await fetch(`http://localhost:3200/a/${assetCode}`, {
      headers: { Cookie: admin.cookie },
      redirect: "manual",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`/assets/${assetId}`);
  });

  it("کد نامعتبر → ریدایرکت به جستجو", async () => {
    const res = await fetch("http://localhost:3200/a/AST-XX-XXX-999999", {
      headers: { Cookie: admin.cookie },
      redirect: "manual",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/assets?q=");
  });

  it("حروف کوچک هم کار می‌کند (normalize)", async () => {
    const res = await fetch(`http://localhost:3200/a/${assetCode.toLowerCase()}`, {
      headers: { Cookie: admin.cookie },
      redirect: "manual",
    });
    expect(res.headers.get("location")).toBe(`/assets/${assetId}`);
  });
});

describe("GET /api/labels/print", () => {
  it("HTML چاپ با برچسب دارایی", async () => {
    const res = await fetch(`http://localhost:3200/api/labels/print?ids=${assetId}`, {
      headers: { Cookie: admin.cookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("برچسب دارایی");
    expect(html).toContain(assetCode);
    expect(html).toContain("print()");
  });

  it("بدون ids → 400", async () => {
    const res = await fetch("http://localhost:3200/api/labels/print", {
      headers: { Cookie: admin.cookie },
    });
    expect(res.status).toBe(400);
  });

  it("employee (بدون asset:view) → 403", async () => {
    const res = await fetch(`http://localhost:3200/api/labels/print?ids=${assetId}`, {
      headers: { Cookie: employeeCookie },
    });
    expect(res.status).toBe(403);
  });
});
