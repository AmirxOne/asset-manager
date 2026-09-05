import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma, applyMigrations, resetDb, login, api } from "./helpers";
import { execSync } from "child_process";

// auth flow کامل: login / me / logout / password / rate-limit / 401
// سرور باید روی :3200 در حال اجرا باشد (vitest آن را مدیریت نمی‌کند — playwright webServer می‌کند)

beforeAll(async () => {
  applyMigrations();
  await resetDb();
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/auth/login", () => {
  it("valid credentials → 200 + cookie + user payload", async () => {
    const res = await fetch("http://localhost:3200/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "admin@ams.local", password: "Admin@123" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.user.email).toBe("admin@ams.local");
    expect(json.data.user.isSuperAdmin).toBe(true);
    expect(json.data.user.roles[0].key).toBe("super_admin");
    const setCookie = res.headers.getSetCookie?.()[0] ?? "";
    expect(setCookie).toContain("ams_session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("wrong password → 401 uniform message", async () => {
    const res = await fetch("http://localhost:3200/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "admin@ams.local", password: "wrong" }),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("unknown identifier → same 401 (no user enumeration)", async () => {
    const res = await fetch("http://localhost:3200/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "ghost@ams.local", password: "x" }),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("malformed body → 400 VALIDATION", async () => {
    const res = await fetch("http://localhost:3200/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "a" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION");
  });
});

describe("auth session lifecycle", () => {
  it("GET /api/auth/me without cookie → 401", async () => {
    const { status, body } = await api("/api/auth/me");
    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("login → me → logout → me با توکن قدیمی → 401", async () => {
    const { cookie } = await login("admin@ams.local", "Admin@123");

    const me = await api("/api/auth/me", { cookie });
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("admin@ams.local");

    const out = await api("/api/auth/logout", { method: "POST", cookie });
    expect(out.status).toBe(200);

    const me2 = await api("/api/auth/me", { cookie });
    expect(me2.status).toBe(401);
  });

  it("inactive user cannot login even with correct password", async () => {
    await prisma.user.update({
      where: { email: "employee@ams.local" },
      data: { isActive: false },
    });
    const { status, body } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "employee@ams.local", password: "Test@1234" }),
    });
    expect(status).toBe(401);
    await prisma.user.update({
      where: { email: "employee@ams.local" },
      data: { isActive: true },
    });
  });
});

describe("PATCH /api/auth/password", () => {
  it("happy path: change → old session invalid → login با رمز جدید", async () => {
    // کاربر تستی اختصاصی
    const hash = await bcrypt.hash("Old@1234", 12);
    const user = await prisma.user.create({
      data: { email: "pwtest@ams.local", fullName: "تست رمز", passwordHash: hash },
    });
    void user;

    const { cookie } = await login("pwtest@ams.local", "Old@1234");

    // رمز فعلی غلط
    let res = await api("/api/auth/password", {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ currentPassword: "nope", newPassword: "New@12345" }),
    });
    expect(res.status).toBe(400);

    // رمز ضعیف
    res = await api("/api/auth/password", {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ currentPassword: "Old@1234", newPassword: "short" }),
    });
    expect(res.status).toBe(400);

    // موفق
    res = await api("/api/auth/password", {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ currentPassword: "Old@1234", newPassword: "New@12345" }),
    });
    expect(res.status).toBe(200);

    // session چرخیده
    const me = await api("/api/auth/me", { cookie });
    expect(me.status).toBe(401);

    // ورود با رمز جدید
    const re = await login("pwtest@ams.local", "New@12345");
    expect(re.user.email).toBe("pwtest@ams.local");
  });
});

describe("login rate limiting", () => {
  it("5 شکست → 429", async () => {
    const res = await fetch("http://localhost:3200/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "ratelimit@ams.local", password: "bad-1" }),
    });
    void res;
    for (let i = 2; i <= 5; i++) {
      await fetch("http://localhost:3200/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "ratelimit@ams.local", password: `bad-${i}` }),
      });
    }
    const blocked = await fetch("http://localhost:3200/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "ratelimit@ams.local", password: "bad-6" }),
    });
    expect(blocked.status).toBe(429);
    const json = await blocked.json();
    expect(json.error.code).toBe("RATE_LIMITED");
  });
});

describe("audit log", () => {
  it("LOGIN و LOGOUT در AuditLog ثبت می‌شوند", async () => {
    const before = await prisma.auditLog.count({ where: { action: "LOGIN" } });
    await login("admin@ams.local", "Admin@123");
    const after = await prisma.auditLog.count({ where: { action: "LOGIN" } });
    expect(after).toBeGreaterThan(before);
  });
});
