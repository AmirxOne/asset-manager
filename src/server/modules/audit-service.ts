import { z } from "zod";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/auth/guards";

export const auditCreateSchema = z.object({
  title: z.string().trim().min(3, "عنوان حداقل ۳ نویسه است").max(120),
  scope: z.enum(["ALL", "DEPARTMENT", "LOCATION"]).default("ALL"),
  scopeId: z.string().min(1).nullable().optional(),
});

export const auditScanSchema = z.object({
  /// کد اسکن‌شده — خود کد یا URL کامل /a/CODE
  code: z.string().trim().min(1, "کد لازم است").max(200),
  note: z.string().trim().max(200).optional(),
});

/** AUD-{سال شمسی}-{۴رقم} */
async function nextAuditCode(): Promise<string> {
  const jy = new Intl.DateTimeFormat("en-u-ca-persian", {
    year: "numeric",
  }).formatToParts(new Date()).find((p) => p.type === "year")?.value ?? String(new Date().getFullYear());
  const prefix = `AUD-${jy}`;
  const row = await prisma.$queryRaw<{ seq: bigint }[]>`
    INSERT INTO "CodeSequence" ("prefix", "seq") VALUES (${prefix}, 1)
    ON CONFLICT ("prefix") DO UPDATE SET "seq" = "CodeSequence"."seq" + 1
    RETURNING "seq"
  `;
  return `${prefix}-${String(Number(row[0].seq)).padStart(4, "0")}`;
}

/** کد را از هر شکل استخراج کن */
function normalizeCode(raw: string): string {
  const m = raw.match(/\/a\/([A-Za-z0-9-]+)/);
  return (m ? m[1] : raw).trim().toUpperCase();
}

/** شروع ممیزی — snapshot انتظار: کد + وضعیت هر دارایی در محدوده */
export async function createAudit(opts: {
  actorId: string;
  title: string;
  scope: "ALL" | "DEPARTMENT" | "LOCATION";
  scopeId?: string | null;
}) {
  if (opts.scope === "DEPARTMENT") {
    const d = await prisma.department.findUnique({ where: { id: opts.scopeId! } });
    if (!d) throw new ApiError(404, "NOT_FOUND", "بخش یافت نشد");
  }
  if (opts.scope === "LOCATION") {
    const l = await prisma.location.findUnique({ where: { id: opts.scopeId! } });
    if (!l) throw new ApiError(404, "NOT_FOUND", "محل یافت نشد");
  }

  // snapshot: وضعیت فعلی هر دارایی زنده در محدوده
  const assets = await prisma.asset.findMany({
    where: {
      isDeleted: false,
      status: { notIn: ["DISPOSED"] },
      ...(opts.scope === "DEPARTMENT" ? { departmentId: opts.scopeId } : {}),
      ...(opts.scope === "LOCATION" ? { locationId: opts.scopeId } : {}),
    },
    select: { id: true, code: true, status: true },
  });
  if (assets.length === 0)
    throw new ApiError(409, "EMPTY_SCOPE", "دارایی‌ای در این محدوده نیست");

  const code = await nextAuditCode();
  const session = await prisma.auditSession.create({
    data: {
      code,
      title: opts.title,
      scope: opts.scope,
      scopeId: opts.scopeId ?? null,
      expectedTotal: assets.length,
      createdById: opts.actorId,
      report: {
        expected: assets.map((a) => ({ assetId: a.id, code: a.code, status: a.status })),
      },
    },
  });
  return session;
}

/** یک اسکن — نتیجه: MATCH / UNEXPECTED / MISMATCH / DUPLICATE */
export async function scanAsset(opts: {
  sessionId: string;
  actorId: string;
  code: string;
  note?: string;
}) {
  const session = await prisma.auditSession.findUnique({ where: { id: opts.sessionId } });
  if (!session) throw new ApiError(404, "NOT_FOUND", "نشست ممیزی یافت نشد");
  if (session.status !== "OPEN") throw new ApiError(409, "AUDIT_CLOSED", "این نشست بسته شده است");

  const code = normalizeCode(opts.code);
  const asset = await prisma.asset.findFirst({
    where: { code, isDeleted: false },
    select: { id: true, code: true, status: true, name: true },
  });

  if (!asset) {
    const scan = await prisma.auditScan.create({
      data: {
        sessionId: session.id,
        assetId: null,
        result: "UNEXPECTED",
        scannedCode: code,
        scannedById: opts.actorId,
        note: opts.note,
      },
    });
    return { result: "UNEXPECTED" as const, scan };
  }

  // تکراری؟
  const dup = await prisma.auditScan.findUnique({
    where: { sessionId_assetId: { sessionId: session.id, assetId: asset.id } },
  });
  if (dup) return { result: "DUPLICATE" as const, scan: dup };

  // در انتظار بود؟ (snapshot)
  const expected = (session.report as { expected: { assetId: string; status: string }[] }).expected;
  const exp = expected.find((e) => e.assetId === asset.id);

  if (!exp) {
    // شناخته شد ولی در محدوده نبود → UNEXPECTED (دارایی معتبر خارج از scope)
    const scan = await prisma.auditScan.create({
      data: {
        sessionId: session.id,
        assetId: asset.id,
        result: "UNEXPECTED",
        scannedCode: code,
        note: "خارج از محدوده ممیزی",
        scannedById: opts.actorId,
      },
    });
    return { result: "UNEXPECTED" as const, scan };
  }

  const match = exp.status === asset.status;
  const scan = await prisma.auditScan.create({
    data: {
      sessionId: session.id,
      assetId: asset.id,
      result: match ? "MATCH" : "MISMATCH",
      scannedCode: code,
      expectedStatus: exp.status,
      foundStatus: asset.status,
      note: opts.note,
      scannedById: opts.actorId,
    },
  });
  return { result: match ? ("MATCH" as const) : ("MISMATCH" as const), scan };
}

/** پیشرفت زنده */
export async function auditProgress(sessionId: string) {
  const session = await prisma.auditSession.findUnique({
    where: { id: sessionId },
    include: { createdBy: { select: { fullName: true } } },
  });
  if (!session) throw new ApiError(404, "NOT_FOUND", "نشست ممیزی یافت نشد");

  const scans = await prisma.auditScan.findMany({
    where: { sessionId },
    include: {
      asset: { select: { id: true, code: true, name: true, status: true } },
      scannedBy: { select: { fullName: true } },
    },
    orderBy: { scannedAt: "desc" },
  });

  const expected = (
    session.report as { expected: { assetId: string; code: string; status: string }[] }
  ).expected;
  const scannedIds = new Set(scans.filter((s) => s.assetId).map((s) => s.assetId!));
  const missing = expected.filter((e) => !scannedIds.has(e.assetId));

  return {
    session,
    counts: {
      expected: session.expectedTotal,
      scanned: scans.length,
      match: scans.filter((s) => s.result === "MATCH").length,
      mismatch: scans.filter((s) => s.result === "MISMATCH").length,
      unexpected: scans.filter((s) => s.result === "UNEXPECTED").length,
      missing: missing.length,
    },
    missingAssets: missing.map((m) => ({
      assetId: m.assetId,
      code: m.code,
    })),
    scans: scans.slice(0, 100),
  };
}

/** بستن — گزارش نهایی + رویداد AUDIT روی دارایی‌های مفقود */
export async function closeAudit(opts: { sessionId: string; actorId: string }) {
  const session = await prisma.auditSession.findUnique({ where: { id: opts.sessionId } });
  if (!session) throw new ApiError(404, "NOT_FOUND", "نشست ممیزی یافت نشد");
  if (session.status === "CLOSED") throw new ApiError(409, "AUDIT_CLOSED", "این نشست بسته شده است");

  const progress = await auditProgress(session.id);

  // دارایی‌های مفقود → رویداد AUDIT_MISSING روی خودشان
  await prisma.$transaction([
    prisma.auditSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedById: opts.actorId,
        closedAt: new Date(),
        report: {
          ...(session.report as object),
          final: {
            closedAt: new Date().toISOString(),
            counts: progress.counts,
          },
        },
      },
    }),
    ...progress.missingAssets.map((m) =>
      prisma.assetEvent.create({
        data: {
          assetId: m.assetId,
          type: "AUDIT",
          actorId: opts.actorId,
          note: `مفقود در ممیزی ${session.code}`,
        },
      }),
    ),
  ]);

  return { closed: true, counts: progress.counts };
}
