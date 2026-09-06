import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

/** GET /api/reports?type=…&format=json|csv|xlsx|pdf — گزارش‌های تجمیعی */

type Row = Record<string, string | number | null>;

const REPORTS: Record<
  string,
  { title: string; run: (q: URLSearchParams) => Promise<{ columns: { key: string; label: string }[]; rows: Row[] }> }
> = {
  by_category: {
    title: "دارایی‌ها به تفکیک دسته",
    run: async () => {
      const g = await prisma.assetCategory.findMany({
        include: { types: { include: { _count: { select: { assets: true } } } } },
        orderBy: { name: "asc" },
      });
      return {
        columns: [
          { key: "category", label: "دسته" },
          { key: "type", label: "نوع" },
          { key: "count", label: "تعداد" },
        ],
        rows: g.flatMap((c) =>
          c.types.map((t) => ({ category: c.name, type: t.name, count: t._count.assets })),
        ),
      };
    },
  },
  by_department: {
    title: "دارایی‌ها به تفکیک بخش",
    run: async () => groupByField("department", "بخش"),
  },
  by_location: {
    title: "دارایی‌ها به تفکیک محل",
    run: async () => groupByField("location", "محل"),
  },
  by_status: {
    title: "دارایی‌ها به تفکیک وضعیت",
    run: async () => {
      const g = await prisma.asset.groupBy({
        by: ["status"],
        where: { isDeleted: false },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: "bucket", label: "وضعیت" },
          { key: "count", label: "تعداد" },
        ],
        rows: g.map((r) => ({ bucket: r.status, count: r._count._all })),
      };
    },
  },
  by_condition: {
    title: "دارایی‌ها به تفکیک وضع ظاهری",
    run: async () => {
      const g = await prisma.asset.groupBy({
        by: ["condition"],
        where: { isDeleted: false },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: "bucket", label: "وضع ظاهری" },
          { key: "count", label: "تعداد" },
        ],
        rows: g.map((r) => ({ bucket: r.condition ?? "ثبت‌نشده", count: r._count._all })),
      };
    },
  },
  by_supplier: {
    title: "دارایی‌ها به تفکیک تأمین‌کننده",
    run: async () => groupByField("supplier", "تأمین‌کننده"),
  },
  by_employee: {
    title: "دارایی‌های تحویل‌شده به کارمندان",
    run: async () => {
      const g = await prisma.employee.findMany({
        where: { heldAssets: { some: {} } },
        include: { _count: { select: { heldAssets: true } } },
        orderBy: { fullName: "asc" },
      });
      return {
        columns: [
          { key: "bucket", label: "کارمند" },
          { key: "count", label: "دارایی در اختیار" },
        ],
        rows: g.map((e) => ({ bucket: `${e.fullName} (${e.personnelCode})`, count: e._count.heldAssets })),
      };
    },
  },
  maintenance_cost: {
    title: "هزینه تعمیرات",
    run: async () => {
      const g = await prisma.maintenanceRecord.groupBy({
        by: ["assetId"],
        where: { status: "DONE" },
        _sum: { cost: true },
        _count: { _all: true },
      });
      const assets = await prisma.asset.findMany({
        where: { id: { in: g.map((r) => r.assetId) } },
        select: { id: true, code: true, name: true },
      });
      const byId = new Map(assets.map((a) => [a.id, a]));
      return {
        columns: [
          { key: "code", label: "کد دارایی" },
          { key: "name", label: "نام" },
          { key: "count", label: "تعداد تعمیر" },
          { key: "sum", label: "جمع هزینه (ریال)" },
        ],
        rows: g
          .map((r) => ({
            code: byId.get(r.assetId)?.code ?? "?",
            name: byId.get(r.assetId)?.name ?? "?",
            count: r._count._all,
            sum: r._sum.cost?.toString() ?? "0",
          }))
          .sort((a, b) => Number(b.sum) - Number(a.sum)),
      };
    },
  },
  lost: {
    title: "دارایی‌های مفقود",
    run: async () => assetList({ status: "LOST" }),
  },
  retired: {
    title: "دارایی‌های بازنشسته",
    run: async () => assetList({ status: "RETIRED" }),
  },
  warranty_expiration: {
    title: "انقضای گارانتی",
    run: async (q) => {
      const days = Number(q.get("withinDays") ?? 90);
      const until = new Date(Date.now() + days * 86400000);
      const rows = await prisma.asset.findMany({
        where: { isDeleted: false, warrantyEnd: { lte: until } },
        orderBy: { warrantyEnd: "asc" },
        select: { code: true, name: true, warrantyEnd: true, supplier: { select: { name: true } } },
      });
      return {
        columns: [
          { key: "code", label: "کد" },
          { key: "name", label: "نام" },
          { key: "date", label: "پایان گارانتی" },
          { key: "supplier", label: "تأمین‌کننده" },
        ],
        rows: rows.map((a) => ({
          code: a.code,
          name: a.name,
          date: a.warrantyEnd ? a.warrantyEnd.toISOString().slice(0, 10) : "—",
          supplier: a.supplier?.name ?? "—",
        })),
      };
    },
  },
  asset_value: {
    title: "ارزش دارایی‌ها",
    run: async () => {
      const g = await prisma.assetType.findMany({
        include: { _count: { select: { assets: true } }, assets: { select: { purchasePrice: true } } },
      });
      return {
        columns: [
          { key: "bucket", label: "نوع" },
          { key: "count", label: "تعداد" },
          { key: "sum", label: "ارزش کل (ریال)" },
        ],
        rows: g
          .map((t) => ({
            bucket: t.name,
            count: t._count.assets,
            sum: t.assets
              .reduce((s, a) => s + (a.purchasePrice ? Number(a.purchasePrice) : 0), 0)
              .toString(),
          }))
          .filter((r) => r.count > 0),
      };
    },
  },
  inventory_audit: {
    title: "گزارش ممیزی‌ها",
    run: async () => {
      const g = await prisma.auditSession.findMany({
        include: { _count: { select: { scans: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return {
        columns: [
          { key: "code", label: "کد ممیزی" },
          { key: "title", label: "عنوان" },
          { key: "expected", label: "انتظار" },
          { key: "scanned", label: "اسکن" },
          { key: "status", label: "وضعیت" },
        ],
        rows: g.map((a) => ({
          code: a.code,
          title: a.title,
          expected: a.expectedTotal,
          scanned: a._count.scans,
          status: a.status,
        })),
      };
    },
  },
  employee_assets: {
    title: "دارایی به ازای هر کارمند",
    run: async (q) => {
      const empId = q.get("employeeId");
      const rows = await prisma.asset.findMany({
        where: { isDeleted: false, holderEmployeeId: empId ?? undefined },
        select: {
          code: true, name: true, status: true,
          holder: { select: { fullName: true } },
        },
        orderBy: { code: "asc" },
        take: 500,
      });
      return {
        columns: [
          { key: "code", label: "کد" },
          { key: "name", label: "نام" },
          { key: "holder", label: "نگهدارنده" },
          { key: "status", label: "وضعیت" },
        ],
        rows: rows.map((a) => ({
          code: a.code,
          name: a.name,
          holder: a.holder?.fullName ?? "—",
          status: a.status,
        })),
      };
    },
  },
};

async function groupByField(
  field: "department" | "location" | "supplier",
  label: string,
): Promise<{ columns: { key: string; label: string }[]; rows: Row[] }> {
  const g = await prisma.asset.groupBy({
    by: [`${field}Id`],
    where: { isDeleted: false },
    _count: { _all: true },
  });
  // نام‌ها
  const ids = g.map((r) => r[`${field}Id`]).filter(Boolean) as string[];
  const names =
    field === "department"
      ? await prisma.department.findMany({ where: { id: { in: ids } } })
      : field === "location"
        ? await prisma.location.findMany({ where: { id: { in: ids } } })
        : await prisma.supplier.findMany({ where: { id: { in: ids } } });
  const nameById = new Map(names.map((n: { id: string; name: string }) => [n.id, n.name]));
  return {
    columns: [
      { key: "bucket", label },
      { key: "count", label: "تعداد دارایی" },
    ],
    rows: g
      .map((r) => ({
        bucket: nameById.get(r[`${field}Id`] as string) ?? "بدون " + label,
        count: r._count._all,
      }))
      .sort((a, b) => (b.count as number) - (a.count as number)),
  };
}

async function assetList(where: Prisma.AssetWhereInput) {
  const rows = await prisma.asset.findMany({
    where: { ...where, isDeleted: false },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      code: true, name: true, status: true, condition: true,
      holder: { select: { fullName: true } },
      location: { select: { name: true } },
    },
  });
  return {
    columns: [
      { key: "code", label: "کد" },
      { key: "name", label: "نام" },
      { key: "status", label: "وضعیت" },
      { key: "condition", label: "وضع ظاهری" },
      { key: "holder", label: "نگهدارنده" },
      { key: "location", label: "محل" },
    ],
    rows: rows.map((a) => ({
      code: a.code,
      name: a.name,
      status: a.status,
      condition: a.condition,
      holder: a.holder?.fullName ?? "—",
      location: a.location?.name ?? "—",
    })),
  };
}

function toCsv(columns: { key: string; label: string }[], rows: Row[]): string {
  const esc = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(",")).join("\n");
  // BOM برای اکسل فارسی
  return "\uFEFF" + head + "\n" + body;
}

function toHtmlTable(title: string, columns: { key: string; label: string }[], rows: Row[]): string {
  const esc = (v: string | number | null) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:Tahoma,sans-serif;margin:24px;color:#0d0d0d}
h1{font-size:16px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #a1a1aa;padding:6px 10px;text-align:right}
th{background:#f4f4f5}
@media print{body{margin:8mm}}
</style></head><body>
<h1>${esc(title)} — ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "full" }).format(new Date())}</h1>
<table><thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
<tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${esc(r[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;
}

export async function GET(req: NextRequest) {
  try {
    const needsExport = (req.nextUrl.searchParams.get("format") ?? "json") !== "json";
    await requirePerm(req, needsExport ? "report:export" : "report:view");

    const type = req.nextUrl.searchParams.get("type") ?? "by_category";
    const report = REPORTS[type];
    if (!report) throw new ApiError(404, "NOT_FOUND", "گزارش نامعتبر");

    const format = req.nextUrl.searchParams.get("format") ?? "json";
    const { columns, rows } = await report.run(req.nextUrl.searchParams);

    if (format === "json") {
      return ok({ report: { type, title: report.title }, columns, rows });
    }
    if (format === "csv") {
      return new Response(toCsv(columns, rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="report-${type}.csv"`,
        },
      });
    }
    if (format === "xlsx") {
      // xlsx ساده = جدول HTML با mime اکسل (Excel مستقیم باز می‌کند، فارسی‌پسند)
      return new Response(toHtmlTable(report.title, columns, rows), {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="report-${type}.xls"`,
        },
      });
    }
    if (format === "pdf") {
      // PDF = صفحه چاپی — کارگر در پنجره چاپ Save-as-PDF می‌زند
      return new Response(toHtmlTable(report.title, columns, rows), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    throw new ApiError(400, "VALIDATION", "فرمت نامعتبر");
  } catch (err) {
    return fail(err);
  }
}
