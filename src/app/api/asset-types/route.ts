import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, requireAuth, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { assetTypeSchema } from "@/server/modules/asset-validations";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/asset-types — لیست انواع (با فیلتر دسته) */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const categoryId = req.nextUrl.searchParams.get("categoryId");
    const types = await prisma.assetType.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { select: { name: true, code: true } } },
      orderBy: { code: "asc" },
    });
    return ok({ types });
  } catch (err) {
    return fail(err);
  }
}

/** POST /api/asset-types */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "category:manage");
    const parsed = assetTypeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;
    const code = data.code.toUpperCase();

    const cat = await prisma.assetCategory.findUnique({ where: { id: data.categoryId } });
    if (!cat) throw new ApiError(404, "NOT_FOUND", "دسته یافت نشد");

    const dup = await prisma.assetType.findUnique({ where: { code } });
    if (dup) throw new ApiError(409, "DUPLICATE", "کد نوع تکراری است");

    const type = await prisma.assetType.create({
      data: { name: data.name, code, categoryId: data.categoryId, description: data.description ?? null },
    });
    await writeAudit({
      actorId: user.id, action: "CREATE", entity: "AssetType", entityId: type.id,
      newValue: type, req,
    });
    return ok({ type }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
