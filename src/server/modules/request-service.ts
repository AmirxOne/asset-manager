import { z } from "zod";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/auth/guards";
import { assignAsset } from "./assignment-service";

export const requestCreateSchema = z.object({
  title: z.string().trim().min(3, "عنوان حداقل ۳ نویسه است").max(120),
  assetTypeId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().min(1).max(50).default(1),
  reason: z.string().trim().max(500).nullable().optional(),
  urgency: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
});

export const requestDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(300).optional(),
});

export const requestFulfillSchema = z.object({
  assetIds: z.array(z.string().min(1)).min(1, "حداقل یک دارایی انتخاب کنید").max(50),
});

/** کد درخواست یکتا: REQ-{سال شمسی}-{۴رقم} */
async function nextRequestCode(): Promise<string> {
  const jy = new Intl.DateTimeFormat("en-u-ca-persian", {
    year: "numeric",
  }).formatToParts(new Date()).find((p) => p.type === "year")?.value ?? String(new Date().getFullYear());
  const prefix = `REQ-${jy}`;
  const row = await prisma.$queryRaw<{ seq: bigint }[]>`
    INSERT INTO "CodeSequence" ("prefix", "seq") VALUES (${prefix}, 1)
    ON CONFLICT ("prefix") DO UPDATE SET "seq" = "CodeSequence"."seq" + 1
    RETURNING "seq"
  `;
  return `${prefix}-${String(Number(row[0].seq)).padStart(4, "0")}`;
}

async function notify(opts: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: object;
}) {
  // کاربرِ لینک‌شده به employee مقصد — در این سامانه اعلان برای user است
  await prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      data: (opts.data ?? undefined) as object | undefined,
    },
  }).catch(() => {});
}

/** userId از طریق employee — برای اعلان به درخواست‌دهنده */
async function userIdOfEmployee(employeeId: string): Promise<string | null> {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { user: { select: { id: true } } },
  });
  return emp?.user?.id ?? null;
}

export async function createRequest(opts: {
  requesterEmployeeId: string;
  actorUserId: string;
  title: string;
  assetTypeId?: string | null;
  quantity: number;
  reason?: string | null;
  urgency: string;
}) {
  const emp = await prisma.employee.findUnique({
    where: { id: opts.requesterEmployeeId },
    include: { user: { select: { id: true } }, department: { select: { id: true, name: true } } },
  });
  if (!emp) throw new ApiError(404, "NOT_FOUND", "پرونده کارمندی شما یافت نشد");
  if (emp.status !== "ACTIVE") throw new ApiError(409, "EMPLOYEE_INACTIVE", "پرونده فعال نیست");

  if (opts.assetTypeId) {
    const t = await prisma.assetType.findUnique({ where: { id: opts.assetTypeId } });
    if (!t) throw new ApiError(404, "NOT_FOUND", "نوع دارایی یافت نشد");
  }

  const code = await nextRequestCode();
  const req = await prisma.assetRequest.create({
    data: {
      code,
      requesterId: emp.id,
      departmentId: emp.department?.id ?? null,
      assetTypeId: opts.assetTypeId ?? null,
      title: opts.title,
      reason: opts.reason ?? null,
      quantity: opts.quantity,
      urgency: opts.urgency,
    },
    include: {
      requester: { select: { fullName: true } },
      assetType: { select: { name: true } },
    },
  });

  // اعلان به مدیر بخش (اگر بخش دارد) — کاربران با نقش dept_manager در آن بخش نداریم؛
  // ساده: به همه کاربرانی که request:approve:manager دارند اعلان می‌رود (فاز ۱۰ scope می‌بندد)
  const approvers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { permissions: { some: { permission: { key: "request:approve:manager" } } } } } },
    },
    select: { id: true },
    take: 20,
  });
  for (const a of approvers) {
    await notify({
      userId: a.id,
      type: "REQUEST_PENDING",
      title: "درخواست جدید در انتظار تأیید",
      body: `${emp.fullName}: ${opts.title}`,
      data: { requestId: req.id },
    });
  }

  void opts.actorUserId;
  return req;
}

/** تأیید/رد — level از status فعلی برمی‌آید */
export async function decideRequest(opts: {
  requestId: string;
  actorId: string;
  level: "MANAGER" | "IT";
  decision: "APPROVED" | "REJECTED";
  note?: string;
}) {
  const req = await prisma.assetRequest.findUnique({
    where: { id: opts.requestId },
    include: { requester: { select: { id: true, fullName: true } } },
  });
  if (!req) throw new ApiError(404, "NOT_FOUND", "درخواست یافت نشد");
  if (req.status === "FULFILLED" || req.status === "REJECTED" || req.status === "CANCELLED")
    throw new ApiError(409, "REQUEST_CLOSED", "این درخواست بسته شده است");

  // مرحله درست؟ MANAGER فقط روی PENDING، IT فقط روی MANAGER_APPROVED
  const expected = opts.level === "MANAGER" ? "PENDING" : "MANAGER_APPROVED";
  if (req.status !== expected)
    throw new ApiError(409, "WRONG_LEVEL", `این درخواست در مرحله «${req.status}» است`);

  const nextStatus =
    opts.decision === "REJECTED" ? "REJECTED"
    : opts.level === "MANAGER" ? "MANAGER_APPROVED"
    : "IT_APPROVED";

  await prisma.$transaction([
    prisma.requestApproval.create({
      data: {
        requestId: req.id,
        level: opts.level,
        approverId: opts.actorId,
        decision: opts.decision,
        note: opts.note,
      },
    }),
    prisma.assetRequest.update({ where: { id: req.id }, data: { status: nextStatus } }),
  ]);

  // اعلان به درخواست‌دهنده
  const uid = await userIdOfEmployee(req.requester.id);
  if (uid) {
    await notify({
      userId: uid,
      type: opts.decision === "REJECTED" ? "REQUEST_REJECTED" : "REQUEST_APPROVED",
      title:
        opts.decision === "REJECTED"
          ? `درخواست ${req.code} رد شد`
          : `درخواست ${req.code} تأیید ${opts.level === "MANAGER" ? "مدیر" : "IT"} شد`,
      body: opts.note,
      data: { requestId: req.id },
    });
  }

  // اگر رد شد در هر مرحله → پایان
  return { status: nextStatus };
}

/** تأمین — تحویل خودکار دارایی‌ها به درخواست‌دهنده */
export async function fulfillRequest(opts: {
  requestId: string;
  actorId: string;
  assetIds: string[];
}) {
  const req = await prisma.assetRequest.findUnique({
    where: { id: opts.requestId },
    include: { requester: { select: { id: true, fullName: true, status: true } } },
  });
  if (!req) throw new ApiError(404, "NOT_FOUND", "درخواست یافت نشد");
  if (req.status !== "IT_APPROVED")
    throw new ApiError(409, "NOT_APPROVED", "تأمین فقط پس از تأیید IT ممکن است");
  if (req.requester.status !== "ACTIVE")
    throw new ApiError(409, "EMPLOYEE_INACTIVE", "درخواست‌دهنده فعال نیست");

  const fulfilled: string[] = [];
  const failed: { assetId: string; error: string }[] = [];

  for (const assetId of opts.assetIds) {
    try {
      await assignAsset({
        assetId,
        employeeId: req.requester.id,
        actorId: opts.actorId,
        note: `تأمین درخواست ${req.code}`,
      });
      fulfilled.push(assetId);
    } catch (err) {
      failed.push({
        assetId,
        error: err instanceof ApiError ? err.message : "خطا",
      });
    }
  }

  if (fulfilled.length > 0) {
    await prisma.$transaction([
      prisma.assetRequestItem.createMany({
        data: fulfilled.map((assetId) => ({ requestId: req.id, assetId })),
      }),
      prisma.assetRequest.update({
        where: { id: req.id },
        data: { status: "FULFILLED", fulfilledById: opts.actorId, fulfilledAt: new Date() },
      }),
    ]);

    const uid = await userIdOfEmployee(req.requester.id);
    if (uid) {
      await notify({
        userId: uid,
        type: "REQUEST_FULFILLED",
        title: `درخواست ${req.code} تأمین شد`,
        body: `${fulfilled.length} دارایی به شما تحویل شد`,
        data: { requestId: req.id },
      });
    }
  }

  return { fulfilled: fulfilled.length, failed };
}

/** لغو توسط درخواست‌دهنده — فقط قبل از تأمین */
export async function cancelRequest(opts: { requestId: string; requesterEmployeeId: string }) {
  const req = await prisma.assetRequest.findUnique({ where: { id: opts.requestId } });
  if (!req) throw new ApiError(404, "NOT_FOUND", "درخواست یافت نشد");
  if (req.requesterId !== opts.requesterEmployeeId)
    throw new ApiError(403, "FORBIDDEN", "فقط درخواست‌دهنده می‌تواند لغو کند");
  if (req.status === "FULFILLED" || req.status === "CANCELLED")
    throw new ApiError(409, "REQUEST_CLOSED", "این درخواست بسته شده است");

  await prisma.assetRequest.update({ where: { id: req.id }, data: { status: "CANCELLED" } });
  return { cancelled: true };
}
