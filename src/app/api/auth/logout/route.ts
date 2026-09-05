import { NextResponse, type NextRequest } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/server/auth/session";
import { fail, requireAuth } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await writeAudit({ actorId: user.id, action: "LOGOUT", entity: "User", entityId: user.id, req });
    await destroySession(req);
    const res = NextResponse.json({ ok: true, data: { loggedOut: true } });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    return fail(err);
  }
}
