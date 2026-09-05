// Helper مشترک integration tests — API routes را با Request واقعی صدا می‌زند
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL =
  "postgresql://meetinghub:meetinghub@localhost:5432/assetmanager_test?schema=public";

export const prisma = new PrismaClient();

const BASE = "http://localhost:3200";

export function applyMigrations() {
  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
}

/** truncate همه جداول (به‌جز _prisma) */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `DO $$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '_prisma%') LOOP EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE'; END LOOP; END $$;`,
  );
}

export interface LoginResult {
  cookie: string;
  user: { id: string; email: string; isSuperAdmin: boolean; permissions: string[] };
}

/** ورود واقعی از API و گرفتن session cookie */
export async function login(identifier: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${identifier}: ${res.status}`);
  const json = await res.json();
  const setCookie = res.headers.getSetCookie?.()[0] ?? res.headers.get("set-cookie") ?? "";
  return { cookie: setCookie.split(";")[0], user: json.data.user };
}

export async function api(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; body: any }> {
  const { cookie, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...rest.headers,
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}
