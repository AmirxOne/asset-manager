import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { createSession, sessionCookieOpts, SESSION_COOKIE, loadSessionUser } from "@/server/auth/session";
import { ApiError, fail, clientIp, assertSameOrigin } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  identifier: z.string().trim().min(3, "شناسه ورود کوتاه است").max(120),
  password: z.string().min(1, "رمز عبور الزامی است").max(128),
});

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

async function isRateLimited(identifier: string, ip: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const attempts = await prisma.loginAttempt.count({
    where: {
      identifier,
      attemptedAt: { gte: since },
      success: false,
      ...(ip ? { OR: [{ ip }, { ip: null }] } : {}),
    },
  });
  return attempts >= MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const { identifier, password } = parsed.data;
    const ip = clientIp(req);

    if (await isRateLimited(identifier, ip)) {
      throw new ApiError(429, "RATE_LIMITED", "تلاش‌های ناموفق زیاد؛ ۱۵ دقیقه صبر کنید");
    }

    const idLower = identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: idLower }, { phone: identifier }] },
    });

    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    await prisma.loginAttempt.create({
      data: { identifier, ip, success: valid },
    }).catch(() => {});

    if (!user || !valid || !user.isActive) {
      // پیام واحد — وجود حساب فاش نشود
      throw new ApiError(401, "INVALID_CREDENTIALS", "شناسه یا رمز عبور اشتباه است");
    }

    const { token, expiresAt } = await createSession(user.id, {
      ip,
      userAgent: req.headers.get("user-agent"),
    });

    await writeAudit({
      actorId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      newValue: { ip },
      req,
    });

    const me = await loadSessionUser(user.id);
    const res = NextResponse.json({ ok: true, data: { user: me } }, { status: 200 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOpts(expiresAt));
    return res;
  } catch (err) {
    return fail(err);
  }
}
