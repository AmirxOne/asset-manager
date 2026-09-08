import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/**
 * Import دارایی از CSV — دو مرحله:
 * POST ?dryRun=1 → اعتبارسنجی + پیش‌نمایش + تشخیص تکراری
 * POST          → ایجاد واقعی (فقط سطرهای valid)
 *
 * ستون‌های CSV (UTF-8 با BOM):
 * name*, typeCode* (مثل LAP), brand, model, serialNumber, purchaseDate (YYYY-MM-DD),
 * purchasePrice, warrantyEnd, locationName, departmentCode, supplierName, notes
 */

const rowSchema = z.object({
  name: z.string().trim().min(2, "نام دارایی حداقل ۲ نویسه است").max(120),
  typeCode: z.string().trim().min(2, "کد نوع الزامی است").max(10),
  brand: z.string().trim().max(60).optional().nullable(),
  model: z.string().trim().max(60).optional().nullable(),
  serialNumber: z.string().trim().max(60).optional().nullable(),
  purchaseDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ باید YYYY-MM-DD باشد").optional().nullable(),
  purchasePrice: z.string().trim().regex(/^\d{1,14}(\.\d{1,2})?$/, "قیمت عددی نیست").optional().nullable(),
  warrantyEnd: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ باید YYYY-MM-DD باشد").optional().nullable(),
  locationName: z.string().trim().max(80).optional().nullable(),
  departmentCode: z.string().trim().max(10).optional().nullable(),
  supplierName: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // BOM حذف
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new ApiError(400, "BAD_CSV", "فایل CSV خالی یا بدون سطر داده است");

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) {
        out.push(cur.trim()); cur = "";
      } else cur += c;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = splitLine(lines[li]);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

const nullable = (v: string | undefined): string | null =>
  v === undefined || v === "" ? null : v;

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const actor = await requirePerm(req, "asset:create");
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

    const body = (await req.json().catch(() => null)) as { csv?: string } | null;
    if (!body?.csv || body.csv.trim().length === 0)
      throw new ApiError(400, "NO_DATA", "محتوای CSV لازم است");

    let parsedCsv: { headers: string[]; rows: Record<string, string>[] };
    try {
      parsedCsv = parseCsv(body.csv);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(400, "BAD_CSV", "CSV قابل خواندن نیست");
    }

    // مراجع برای resolve
    const types = await prisma.assetType.findMany({ select: { id: true, code: true, name: true } });
    const typeByCode = new Map(types.map((t) => [t.code.toUpperCase(), t]));
    const locations = await prisma.location.findMany({ select: { id: true, name: true } });
    const locByName = new Map(locations.map((l) => [l.name, l]));
    const departments = await prisma.department.findMany({ select: { id: true, code: true, name: true } });
    const deptByCode = new Map(departments.map((d) => [d.code ?? "", d]));
    deptByCode.set("", departments[0]!); // بدون کد → اولین (IT)
    const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
    const supByName = new Map(suppliers.map((s) => [s.name, s]));

    const report: {
      row: number; status: "VALID" | "ERROR"; errors?: Record<string, string>;
      name: string; typeCode: string; code?: string;
    }[] = [];

    const validRows: { data: z.infer<typeof rowSchema>; type: { id: string; code: string } }[] = [];

    for (let i = 0; i < parsedCsv.rows.length; i++) {
      const raw = parsedCsv.rows[i];
      const input = {
        name: raw.name ?? "",
        typeCode: raw.typeCode ?? "",
        brand: nullable(raw.brand),
        model: nullable(raw.model),
        serialNumber: nullable(raw.serialNumber),
        purchaseDate: nullable(raw.purchaseDate),
        purchasePrice: nullable(raw.purchasePrice),
        warrantyEnd: nullable(raw.warrantyEnd),
        locationName: nullable(raw.locationName),
        departmentCode: nullable(raw.departmentCode),
        supplierName: nullable(raw.supplierName),
        notes: nullable(raw.notes),
      };
      const parsed = rowSchema.safeParse(input);
      if (!parsed.success) {
        report.push({ row: i + 2, status: "ERROR", errors: parsed.error.flatten().fieldErrors as Record<string, string>, name: input.name, typeCode: input.typeCode });
        continue;
      }
      const type = typeByCode.get(parsed.data.typeCode.toUpperCase());
      if (!type) {
        report.push({ row: i + 2, status: "ERROR", errors: { typeCode: `کد نوع «${parsed.data.typeCode}» وجود ندارد` }, name: parsed.data.name, typeCode: parsed.data.typeCode });
        continue;
      }
      // سریال تکراری؟
      if (parsed.data.serialNumber) {
        const dup = await prisma.asset.findFirst({ where: { serialNumber: parsed.data.serialNumber, isDeleted: false } });
        if (dup) {
          report.push({ row: i + 2, status: "ERROR", errors: { serialNumber: `سریال تکراری (دارای ${dup.code})` }, name: parsed.data.name, typeCode: parsed.data.typeCode });
          continue;
        }
      }
      // نام تکراری در همین فایل؟
      if (validRows.some((v) => v.data.name === parsed.data.name)) {
        report.push({ row: i + 2, status: "ERROR", errors: { name: "نام تکراری در فایل" }, name: parsed.data.name, typeCode: parsed.data.typeCode });
        continue;
      }
      validRows.push({ data: parsed.data, type: { id: type.id, code: type.code } });
      report.push({ row: i + 2, status: "VALID", name: parsed.data.name, typeCode: parsed.data.typeCode });
    }

    const summary = {
      total: parsedCsv.rows.length,
      valid: validRows.length,
      errors: report.filter((r) => r.status === "ERROR").length,
    };

    if (dryRun || validRows.length === 0) {
      return ok({ dryRun: true, summary, report });
    }

    // ایجاد واقعی — از همان سرویس کد اتمیک
    const { generateAssetCode } = await import("@/server/modules/code-generator");
    const typesFull = await prisma.assetType.findMany({
      select: { id: true, code: true, category: { select: { code: true } } },
    });
    const typeById = new Map(typesFull.map((t) => [t.id, t]));

    const created: string[] = [];
    for (const v of validRows.slice(0, 200)) {
      const tf = typeById.get(v.type.id)!;
      const code = await generateAssetCode(tf.category.code, tf.code);
      const asset = await prisma.asset.create({
        data: {
          code,
          name: v.data.name,
          assetTypeId: v.type.id,
          brand: v.data.brand,
          model: v.data.model,
          serialNumber: v.data.serialNumber,
          purchaseDate: v.data.purchaseDate ? new Date(v.data.purchaseDate) : null,
          purchasePrice: v.data.purchasePrice ?? null,
          warrantyEnd: v.data.warrantyEnd ? new Date(v.data.warrantyEnd) : null,
          locationId: v.data.locationName ? locByName.get(v.data.locationName)?.id ?? null : null,
          departmentId: v.data.departmentCode ? deptByCode.get(v.data.departmentCode)?.id ?? null : null,
          supplierId: v.data.supplierName ? supByName.get(v.data.supplierName)?.id ?? null : null,
          notes: v.data.notes,
          createdById: actor.id,
        },
        select: { id: true, code: true },
      });
      await prisma.assetEvent.create({
        data: {
          assetId: asset.id,
          type: "CREATED",
          actorId: actor.id,
          note: "ورود گروهی از CSV",
        },
      });
      created.push(asset.code);
    }

    await writeAudit({
      actorId: actor.id, action: "BULK", entity: "Asset", entityId: "import",
      newValue: { created: created.length, errors: summary.errors }, req,
    });

    return ok({ dryRun: false, summary: { ...summary, created: created.length }, report, created });
  } catch (err) {
    return fail(err);
  }
}
