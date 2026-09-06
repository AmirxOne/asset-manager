import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError } from "@/server/auth/guards";
import { auditProgress } from "@/server/modules/audit-service";

export const dynamic = "force-dynamic";

/** GET /api/audits/{id} — جزئیات + شمارنده‌های زنده */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm(req, "audit:view");
    const { id } = await params;
    const progress = await auditProgress(id);
    return ok(progress);
  } catch (err) {
    return fail(err);
  }
}
