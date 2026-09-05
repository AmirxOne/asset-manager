import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

// ماتریس RBAC سند 03 — روی دیتابیس seed شده اعتبارسنجی می‌شود
process.env.DATABASE_URL =
  "postgresql://meetinghub:meetinghub@localhost:5432/assetmanager_test?schema=public";

const prisma = new PrismaClient();

// نقش → مجموعه‌ی موردانتظار (از سند 03)
const EXPECTED: Record<string, string[]> = {
  employee: ["request:create"],
  dept_manager: [
    "asset:view", "request:create", "request:viewAll", "request:approve:manager",
    "dashboard:view", "report:view",
  ],
  it_staff: [
    "asset:view", "asset:create", "asset:update", "asset:assign", "asset:return",
    "asset:transfer", "maintenance:view", "maintenance:manage", "request:create",
    "request:fulfill", "audit:view", "dashboard:view",
  ],
  warehouse_manager: [
    "asset:view", "asset:bulk", "location:manage", "warehouse:manage",
    "maintenance:view", "request:create", "audit:view", "audit:manage", "audit:scan",
    "dashboard:view", "report:view",
  ],
};

// نقش‌هایی که این permission را نباید داشته باشند
const MUST_NOT: Record<string, string[]> = {
  employee: ["asset:view", "asset:create", "user:manage", "report:view", "audit:view"],
  dept_manager: ["asset:create", "asset:assign", "user:manage", "role:manage"],
  it_staff: ["asset:retire", "asset:dispose", "user:manage", "role:manage", "settings:manage"],
  warehouse_manager: ["asset:create", "asset:retire", "user:manage", "report:export"],
  it_manager: ["asset:retire", "asset:dispose", "user:manage", "audit-log:view", "settings:manage"],
  asset_manager: ["user:manage", "role:manage", "settings:manage"],
};

beforeAll(async () => {
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  // seed
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function permsOf(roleKey: string): Promise<Set<string>> {
  const role = await prisma.role.findUnique({
    where: { key: roleKey },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) throw new Error(`role ${roleKey} not found — seed ran?`);
  return new Set(role.permissions.map((rp) => rp.permission.key));
}

describe("RBAC matrix (seeded)", () => {
  for (const [roleKey, expectedPerms] of Object.entries(EXPECTED)) {
    it(`role ${roleKey} has exactly the expected permissions`, async () => {
      const perms = await permsOf(roleKey);
      for (const p of expectedPerms) {
        expect(perms.has(p), `${roleKey} should have ${p}`).toBe(true);
      }
      expect(perms.size).toBe(expectedPerms.length);
    });
  }

  for (const [roleKey, forbidden] of Object.entries(MUST_NOT)) {
    it(`role ${roleKey} does NOT have forbidden permissions`, async () => {
      const perms = await permsOf(roleKey);
      for (const p of forbidden) {
        expect(perms.has(p), `${roleKey} must NOT have ${p}`).toBe(false);
      }
    });
  }

  it("super_admin role contains every permission", async () => {
    const total = await prisma.permission.count();
    const perms = await permsOf("super_admin");
    expect(perms.size).toBe(total);
  });

  it("all 7 system roles exist", async () => {
    const count = await prisma.role.count();
    expect(count).toBe(7);
  });
});
