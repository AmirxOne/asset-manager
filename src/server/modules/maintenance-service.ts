import { z } from "zod";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/auth/guards";
import { canTransition, type AssetStatus } from "./asset-lifecycle";

const decimalString = z.string().trim().regex(/^\d{1,14}(\.\d{1,2})?$/, "مبلغ نامعتبر است");

export const maintenanceCreateSchema = z.object({
  assetId: z.string().min(1, "دارایی الزامی است"),
  problem: z.string().trim().min(3, "شرح ایراد حداقل ۳ نویسه است").max(300),
  description: z.string().trim().max(2000).nullable().optional(),
  technicianId: z.string().min(1).nullable().optional(),
  technicianName: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const maintenanceUpdateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  problem: z.string().trim().min(3).max(300).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  technicianId: z.string().min(1).nullable().optional(),
  technicianName: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  parts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        quantity: z.number().int().min(1).max(999),
        unitCost: decimalString.nullable().optional(),
      }),
    )
    .max(50)
    .optional(),
});

export const maintenanceCompleteSchema = z.object({
  cost: decimalString.optional(),
  notes: z.string().trim().max(1000).optional(),
  /// بعد از تعمیر: AVAILABLE یا IN_STOCK
  returnTo: z.enum(["AVAILABLE", "IN_STOCK"]).default("AVAILABLE"),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "DAMAGED", "BROKEN"]).optional(),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "نام حداقل ۲ نویسه است").max(100),
  contactName: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  email: z.string().email("ایمیل نامعتبر است").nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  taxId: z.string().trim().max(30).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

// =====================================================================
// سرویس تعمیر — گذار وضعیت دارایی همیشه همراه رکورد تعمیر
// =====================================================================

/** شروع تعمیر: دارایی → MAINTENANCE (اگر گذار مجاز باشد) */
export async function openMaintenance(opts: {
  assetId: string;
  problem: string;
  description?: string | null;
  technicianId?: string | null;
  technicianName?: string | null;
  notes?: string | null;
  actorId: string;
}) {
  const asset = await prisma.asset.findFirst({ where: { id: opts.assetId, isDeleted: false } });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");

  // تعمیر فعال قبلی؟
  const active = await prisma.maintenanceRecord.findFirst({
    where: { assetId: asset.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  if (active) throw new ApiError(409, "MAINTENANCE_OPEN", "این دارایی تعمیر باز دارد");

  const from = asset.status as AssetStatus;
  const to: AssetStatus = "MAINTENANCE";
  if (!canTransition(from, to))
    throw new ApiError(409, "ASSET_INVALID_TRANSITION", `ارسال به تعمیر از وضعیت «${from}» مجاز نیست`);

  const [record] = await prisma.$transaction([
    prisma.maintenanceRecord.create({
      data: {
        assetId: asset.id,
        problem: opts.problem,
        description: opts.description ?? null,
        technicianId: opts.technicianId ?? null,
        technicianName: opts.technicianName ?? null,
        notes: opts.notes ?? null,
        createdById: opts.actorId,
        status: "OPEN",
      },
      include: { asset: { select: { code: true, name: true } } },
    }),
    prisma.asset.update({
      where: { id: asset.id },
      data: { status: to, lifecycleStage: "MAINTENANCE" },
    }),
    prisma.assetEvent.create({
      data: {
        assetId: asset.id,
        type: "MAINTENANCE",
        fromStatus: from,
        toStatus: to,
        actorId: opts.actorId,
        note: opts.problem,
      },
    }),
  ]);
  return record;
}

/** تکمیل تعمیر: بستن رکورد + دارایی → returnTo + رویداد REPAIRED */
export async function completeMaintenance(opts: {
  maintenanceId: string;
  cost?: string;
  notes?: string;
  returnTo: "AVAILABLE" | "IN_STOCK";
  condition?: string;
  actorId: string;
}) {
  const record = await prisma.maintenanceRecord.findUnique({
    where: { id: opts.maintenanceId },
    include: { asset: true, parts: true },
  });
  if (!record) throw new ApiError(404, "NOT_FOUND", "تعمیر یافت نشد");
  if (record.status === "DONE" || record.status === "CANCELLED")
    throw new ApiError(409, "MAINTENANCE_CLOSED", "این تعمیر بسته شده است");

  const asset = record.asset;
  const from = asset.status as AssetStatus;
  if (!canTransition(from, opts.returnTo))
    throw new ApiError(409, "ASSET_INVALID_TRANSITION", `بازگشت به «${opts.returnTo}» از وضعیت «${from}» مجاز نیست`);

  // هزینه کل = هزینه واردشده + قطعات
  const partsTotal = record.parts.reduce(
    (sum, p) => sum + (p.unitCost ? Number(p.unitCost) * p.quantity : 0),
    0,
  );
  const totalCost = (opts.cost ? Number(opts.cost) : 0) + partsTotal;

  await prisma.$transaction([
    prisma.maintenanceRecord.update({
      where: { id: record.id },
      data: {
        status: "DONE",
        endDate: new Date(),
        cost: totalCost > 0 ? totalCost.toFixed(2) : null,
        notes: opts.notes ?? record.notes,
      },
    }),
    prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: opts.returnTo,
        lifecycleStage: "REPAIRED",
        ...(opts.condition ? { condition: opts.condition } : {}),
      },
    }),
    prisma.assetEvent.create({
      data: {
        assetId: asset.id,
        type: "REPAIRED",
        fromStatus: from,
        toStatus: opts.returnTo,
        actorId: opts.actorId,
        note: `تعمیر کامل شد${totalCost > 0 ? ` — هزینه: ${totalCost}` : ""}`,
      },
    }),
  ]);

  return { done: true, totalCost };
}

/** لغو تعمیر: دارایی برمی‌گردد به AVAILABLE (بدون تغییر REPAIRED) */
export async function cancelMaintenance(opts: { maintenanceId: string; actorId: string }) {
  const record = await prisma.maintenanceRecord.findUnique({
    where: { id: opts.maintenanceId },
    include: { asset: true },
  });
  if (!record) throw new ApiError(404, "NOT_FOUND", "تعمیر یافت نشد");
  if (record.status === "DONE" || record.status === "CANCELLED")
    throw new ApiError(409, "MAINTENANCE_CLOSED", "این تعمیر بسته شده است");

  const asset = record.asset;
  const from = asset.status as AssetStatus;
  const to: AssetStatus = "AVAILABLE";
  const canReturn = canTransition(from, to);

  await prisma.$transaction([
    prisma.maintenanceRecord.update({
      where: { id: record.id },
      data: { status: "CANCELLED", endDate: new Date() },
    }),
    ...(canReturn
      ? [
          prisma.asset.update({ where: { id: asset.id }, data: { status: to } }),
          prisma.assetEvent.create({
            data: {
              assetId: asset.id,
              type: "STATUS_CHANGE",
              fromStatus: from,
              toStatus: to,
              actorId: opts.actorId,
              note: "لغو تعمیر — بازگشت به موجود",
            },
          }),
        ]
      : []),
  ]);
  return { cancelled: true };
}
