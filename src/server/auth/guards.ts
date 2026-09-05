import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "./session";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  console.error("[api] unhandled:", err);
  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL", message: "خطای داخلی سرور" } },
    { status: 500 },
  );
}

export function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/** guard: کاربر لاگین‌شده — وگرنه 401 */
export async function requireAuth(req: NextRequest) {
  const user = await getSession(req);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "ورود لازم است");
  return user;
}

/** guard: permission مشخص — superAdmin همه‌چیز دارد */
export async function requirePerm(req: NextRequest, perm: string) {
  const user = await requireAuth(req);
  const has = user.isSuperAdmin || user.permissions.includes(perm);
  if (!has) throw new ApiError(403, "FORBIDDEN", "دسترسی لازم را ندارید");
  return user;
}

/** بررسی same-origin برای mutationها (CSRF) */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetch بدون Origin (مثل curl/سرویس) — cookie لازم است به‌هرحال
  const host = req.headers.get("host");
  try {
    if (new URL(origin).host !== host) {
      throw new ApiError(403, "CSRF", "درخواست خارجی رد شد");
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, "CSRF", "درخواست خارجی رد شد");
  }
}
