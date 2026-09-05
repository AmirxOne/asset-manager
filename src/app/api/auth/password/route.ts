import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ApiError, ok, fail, requireAuth, assertSameOrigin } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1, "رمز فعلی الزامی است"),
  newPassword: z
    .string()
    .min(8, "رمز جدید حداقل ۸ کاراکتر است")
    .regex(/[a-zA-Z]/, "رمز باید شامل حرف باشد")
    .regex(/[0-9]/, "رمز باید شامل رقم باشد"),
});

export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requireAuth(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new ApiError(404, "NOT_FOUND", "کاربر یافت نشد");

    const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash);
    if (!valid) throw new ApiError(400, "INVALID_CREDENTIALS", "رمز فعلی اشتباه است");

    if (await bcrypt.compare(parsed.data.newPassword, dbUser.passwordHash)) {
      throw new ApiError(400, "VALIDATION", "رمز جدید نباید با رمز فعلی یکسان باشد");
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // چرخش sessionها بعد از تغییر رمز
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    return ok({ changed: true });
  } catch (err) {
    return fail(err);
  }
}
