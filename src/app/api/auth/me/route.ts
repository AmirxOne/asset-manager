import type { NextRequest } from "next/server";
import { ok, fail, requireAuth } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    return ok({ user });
  } catch (err) {
    return fail(err);
  }
}
