import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail } from "@/server/auth/guards";
import { requireAuth, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { categorySchema } from "@/server/modules/asset-validations";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/categories — درخت دسته‌ها (همه کاربران لاگین‌شده) */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const cats = await prisma.assetCategory.findMany({
      where: { isActive: true },
      include: { parent: { select: { name: true } }, _count: { select: { types: true } } },
      orderBy: { code: "asc" },
    });
    return ok({ categories: cats });
  } catch (err) {
    return fail(err);
  }
}

/** POST /api/categories — ایجاد دسته */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "category:manage");
    const parsed = categorySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;
    const code = data.code.toUpperCase();

    const dup = await prisma.assetCategory.findUnique({ where: { code } });
    if (dup) throw new ApiError(409, "DUPLICATE", "کد دسته تکراری است");

    if (data.parentId) {
      const parent = await prisma.assetCategory.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new ApiError(404, "NOT_FOUND", "دسته والد یافت نشد");
    }

    const cat = await prisma.assetCategory.create({
      data: {
        name: data.name,
        code,
        parentId: data.parentId ?? null,
        description: data.description ?? null,
        defaultWarrantyMonths: data.defaultWarrantyMonths ?? null,
      },
    });

    await writeAudit({
      actorId: user.id, action: "CREATE", entity: "AssetCategory", entityId: cat.id,
      newValue: cat, req,
    });
    return ok({ category: cat }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
