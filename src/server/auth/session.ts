import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";

export const SESSION_COOKIE = "ams_session";
const SESSION_TTL_DAYS = 7;
const SESSION_IDLE_DAYS = 14;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  isSuperAdmin: boolean;
  roles: { key: string; name: string }[];
  permissions: string[];
}

/** بارگذاری user + roles + permissions برای session */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  if (!user || !user.isActive) return null;

  const roleKeys = new Set<string>();
  const permissions = new Set<string>();
  for (const ur of user.roles) {
    roleKeys.add(ur.role.key);
    for (const rp of ur.role.permissions) permissions.add(rp.permission.key);
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    isSuperAdmin: user.isSuperAdmin,
    roles: user.roles.map((ur) => ({ key: ur.role.key, name: ur.role.name })),
    permissions: user.isSuperAdmin ? ["*"] : [...permissions],
  };
}

/** ایجاد session جدید — فقط هش توکن در DB ذخیره می‌شود */
export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return { token, expiresAt };
}

/** خواندن session از cookie — تراکنش، rollback نشود جز به‌روزرسانی lastSeen */
export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session) return null;

  const now = Date.now();
  const expired =
    session.expiresAt.getTime() < now ||
    now - session.lastSeenAt.getTime() > SESSION_IDLE_DAYS * 24 * 3600 * 1000;
  if (expired) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const user = await loadSessionUser(session.userId);
  if (!user) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // rollover lastSeen (به‌روزرسانی بدون رد کردن درخواست)
  prisma.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});
  return user;
}

export async function destroySession(req: NextRequest): Promise<void> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export const sessionCookieOpts = (expiresAt: Date) =>
  ({
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  }) as const;
