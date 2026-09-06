import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, requireAuth, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { locationSchema } from "@/server/modules/assignment-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      include: { parent: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return ok({ locations });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "location:manage");
    const parsed = locationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    if (d.code) {
      const dup = await prisma.location.findUnique({ where: { code: d.code } });
      if (dup) throw new ApiError(409, "DUPLICATE", "کد محل تکراری است");
    }
    if (d.parentId) {
      const p = await prisma.location.findUnique({ where: { id: d.parentId } });
      if (!p) throw new ApiError(404, "NOT_FOUND", "محل والد یافت نشد");
    }

    const loc = await prisma.location.create({
      data: {
        name: d.name,
        code: d.code ?? null,
        type: d.type,
        parentId: d.parentId ?? null,
        address: d.address ?? null,
      },
      include: { parent: { select: { name: true } } },
    });
    await writeAudit({ actorId: user.id, action: "CREATE", entity: "Location", entityId: loc.id, newValue: loc, req });
    return ok({ location: loc }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
