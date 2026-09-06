import { z } from "zod";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/auth/guards";
import { canTransition, type AssetStatus } from "./asset-lifecycle";

/** زد validation فاز ۳ */
export const employeeSchema = z.object({
  fullName: z.string().trim().min(3, "نام حداقل ۳ نویسه است").max(80),
  personnelCode: z.string().trim().regex(/^[A-Za-z0-9\-]{2,20}$/, "کد پرسنلی ۲ تا ۲۰ نویسه لاتین/رقم"),
  departmentId: z.string().min(1).nullable().optional(),
  position: z.string().trim().max(80).nullable().optional(),
  managerId: z.string().min(1).nullable().optional(),
  email: z.string().email("ایمیل نامعتبر است").nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "TERMINATED"]).optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "نام بخش حداقل ۲ نویسه است").max(60),
  code: z.string().trim().regex(/^[A-Za-z0-9]{1,10}$/).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const locationSchema = z.object({
  name: z.string().trim().min(2, "نام محل حداقل ۲ نویسه است").max(80),
  code: z.string().trim().regex(/^[A-Za-z0-9]{1,10}$/).nullable().optional(),
  type: z.enum(["BUILDING", "FLOOR", "ROOM", "WAREHOUSE", "BRANCH"]),
  parentId: z.string().min(1).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const assignSchema = z.object({
  employeeId: z.string().min(1, "کارمند الزامی است"),
  note: z.string().trim().max(500).optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const returnSchema = z.object({
  toStatus: z.enum(["AVAILABLE", "IN_STOCK"]).default("AVAILABLE"),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "DAMAGED", "BROKEN"]).optional(),
  toLocationId: z.string().min(1).optional(),
  note: z.string().trim().max(500).optional(),
});

export const transferSchema = z.object({
  toEmployeeId: z.string().min(1, "کارمند مقصد الزامی است"),
  note: z.string().trim().max(500).optional(),
});

// =====================================================================
// سرویس تخصیص — همه عملیات اتمیک (تراکنش) + رویداد تاریخچه
// =====================================================================

export async function assignAsset(opts: {
  assetId: string;
  employeeId: string;
  actorId: string;
  note?: string;
  dueAt?: string;
}) {
  const asset = await prisma.asset.findFirst({ where: { id: opts.assetId, isDeleted: false } });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");

  // یک assignment فعال → 409 (اول return یا transfer)
  const active = await prisma.assignment.findFirst({
    where: { assetId: asset.id, status: "ACTIVE" },
  });
  if (active) throw new ApiError(409, "ASSET_ALREADY_ASSIGNED", "این دارایی تحویل‌شده است — اول عودت یا انتقال");

  const employee = await prisma.employee.findUnique({ where: { id: opts.employeeId } });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "کارمند یافت نشد");
  if (employee.status !== "ACTIVE")
    throw new ApiError(409, "EMPLOYEE_INACTIVE", "کارمد فعال نیست");

  const from = asset.status as AssetStatus;
  const to: AssetStatus = "ASSIGNED";
  if (!canTransition(from, to))
    throw new ApiError(409, "ASSET_INVALID_TRANSITION", `تحویل از وضعیت «${from}» مجاز نیست`);

  const assignment = await prisma.$transaction([
    prisma.assignment.create({
      data: {
        assetId: asset.id,
        employeeId: employee.id,
        assignedById: opts.actorId,
        conditionAtAssign: asset.condition,
        assignNote: opts.note,
        ...(opts.dueAt ? { dueAt: new Date(opts.dueAt) } : {}),
      },
      include: { employee: { select: { fullName: true, personnelCode: true } } },
    }),
    prisma.asset.update({
      where: { id: asset.id },
      data: { status: to, holderEmployeeId: employee.id },
    }),
    prisma.assetEvent.create({
      data: {
        assetId: asset.id,
        type: "ASSIGNED",
        fromStatus: from,
        toStatus: to,
        toEmployeeId: employee.id,
        actorId: opts.actorId,
        note: opts.note,
      },
    }),
  ]);
  return assignment[0];
}

export async function returnAsset(opts: {
  assetId: string;
  actorId: string;
  toStatus: "AVAILABLE" | "IN_STOCK";
  condition?: string;
  toLocationId?: string;
  note?: string;
}) {
  const asset = await prisma.asset.findFirst({ where: { id: opts.assetId, isDeleted: false } });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");

  const active = await prisma.assignment.findFirst({
    where: { assetId: asset.id, status: "ACTIVE" },
  });
  if (!active) throw new ApiError(409, "NOT_ASSIGNED", "این دارایی به کسی تحویل نشده است");

  const from = asset.status as AssetStatus;
  if (!canTransition(from, opts.toStatus))
    throw new ApiError(409, "ASSET_INVALID_TRANSITION", `عودت به «${opts.toStatus}» از این وضعیت مجاز نیست`);

  if (opts.toLocationId) {
    const loc = await prisma.location.findUnique({ where: { id: opts.toLocationId } });
    if (!loc) throw new ApiError(404, "NOT_FOUND", "محل یافت نشد");
  }

  await prisma.$transaction([
    prisma.assignment.update({
      where: { id: active.id },
      data: {
        status: "RETURNED",
        returnedAt: new Date(),
        returnedById: opts.actorId,
        conditionAtReturn: opts.condition,
        returnNote: opts.note,
      },
    }),
    prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: opts.toStatus,
        holderEmployeeId: null,
        ...(opts.condition ? { condition: opts.condition } : {}),
        ...(opts.toLocationId ? { locationId: opts.toLocationId } : {}),
      },
    }),
    prisma.assetEvent.create({
      data: {
        assetId: asset.id,
        type: "RETURNED",
        fromStatus: from,
        toStatus: opts.toStatus,
        fromEmployeeId: active.employeeId,
        actorId: opts.actorId,
        note: opts.note,
        ...(opts.toLocationId ? { toLocationId: opts.toLocationId } : {}),
      },
    }),
  ]);

  return { returned: true };
}

/** انتقال = عودت + تحویل جدید در یک تراکنش */
export async function transferAsset(opts: {
  assetId: string;
  toEmployeeId: string;
  actorId: string;
  note?: string;
}) {
  const asset = await prisma.asset.findFirst({ where: { id: opts.assetId, isDeleted: false } });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");

  const active = await prisma.assignment.findFirst({
    where: { assetId: asset.id, status: "ACTIVE" },
  });
  if (!active) throw new ApiError(409, "NOT_ASSIGNED", "انتقال فقط برای دارایی تحویل‌شده ممکن است");
  if (active.employeeId === opts.toEmployeeId)
    throw new ApiError(409, "SAME_EMPLOYEE", "دارایی همین حالا نزد این کارمند است");

  const toEmployee = await prisma.employee.findUnique({ where: { id: opts.toEmployeeId } });
  if (!toEmployee || toEmployee.status !== "ACTIVE")
    throw new ApiError(409, "EMPLOYEE_INACTIVE", "کارمند مقصد فعال نیست");

  await prisma.$transaction([
    // بستن قبلی
    prisma.assignment.update({
      where: { id: active.id },
      data: {
        status: "RETURNED",
        returnedAt: new Date(),
        returnedById: opts.actorId,
        returnNote: `انتقال به ${toEmployee.fullName}`,
      },
    }),
    // تحویل جدید
    prisma.assignment.create({
      data: {
        assetId: asset.id,
        employeeId: toEmployee.id,
        assignedById: opts.actorId,
        conditionAtAssign: asset.condition,
        assignNote: opts.note ?? "انتقال",
      },
    }),
    prisma.asset.update({
      where: { id: asset.id },
      data: { holderEmployeeId: toEmployee.id, status: "ASSIGNED", lifecycleStage: "TRANSFERRED" },
    }),
    prisma.assetEvent.create({
      data: {
        assetId: asset.id,
        type: "TRANSFERRED",
        fromStatus: asset.status,
        toStatus: "ASSIGNED",
        fromEmployeeId: active.employeeId,
        toEmployeeId: toEmployee.id,
        actorId: opts.actorId,
        note: opts.note,
      },
    }),
  ]);

  return { transferred: true };
}
