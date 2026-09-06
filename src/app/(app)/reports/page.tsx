"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Card, CardHeader, CardBody, EmptyState, SkeletonTable } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileSpreadsheet, Printer } from "@/components/ui/icon";

const REPORT_TYPES: { value: string; label: string }[] = [
  { value: "by_category", label: "به تفکیک دسته" },
  { value: "by_department", label: "به تفکیک بخش" },
  { value: "by_employee", label: "به تفکیک کارمند" },
  { value: "by_location", label: "به تفکیک محل" },
  { value: "by_status", label: "به تفکیک وضعیت" },
  { value: "by_condition", label: "به تفکیک وضع ظاهری" },
  { value: "by_supplier", label: "به تفکیک تأمین‌کننده" },
  { value: "maintenance_cost", label: "هزینه تعمیرات" },
  { value: "lost", label: "دارایی‌های مفقود" },
  { value: "retired", label: "دارایی‌های بازنشسته" },
  { value: "warranty_expiration", label: "انقضای گارانتی" },
  { value: "asset_value", label: "ارزش دارایی‌ها" },
  { value: "inventory_audit", label: "گزارش ممیزی‌ها" },
  { value: "employee_assets", label: "دارایی هر کارمند" },
];

interface ReportData {
  report: { type: string; title: string };
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
}

export default function ReportsPage() {
  const { can } = useAuth();
  const [type, setType] = useState("by_category");
  const [withinDays, setWithinDays] = useState("90");

  const { data, isLoading } = useQuery({
    queryKey: ["report", type, withinDays],
    queryFn: () =>
      api<ReportData>(
        `/api/reports?type=${type}${type === "warranty_expiration" ? `&withinDays=${withinDays}` : ""}`,
      ),
  });

  const canExport = can("report:export");

  function exportUrl(format: string) {
    const p = new URLSearchParams({ type, format });
    if (type === "warranty_expiration") p.set("withinDays", withinDays);
    return `/api/reports?${p}`;
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">گزارش‌ها</h1>
          <p className="mt-1 text-[13px] text-ink-soft">{data ? data.report.title : "…"}</p>
        </div>
        {canExport && (
          <div className="flex gap-2">
            <a href={exportUrl("csv")} download>
              <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5" />CSV</Button>
            </a>
            <a href={exportUrl("xlsx")} download>
              <Button size="sm" variant="outline"><FileSpreadsheet className="h-3.5 w-3.5" />اکسل</Button>
            </a>
            <a href={exportUrl("pdf")} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline"><Printer className="h-3.5 w-3.5" />PDF (چاپ)</Button>
            </a>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-64">
          <Select value={type} onChange={setType} options={REPORT_TYPES} />
        </div>
        {type === "warranty_expiration" && (
          <div className="w-40">
            <Select
              value={withinDays}
              onChange={setWithinDays}
              options={[
                { value: "30", label: "۳۰ روز" },
                { value: "90", label: "۹۰ روز" },
                { value: "180", label: "۶ ماه" },
                { value: "365", label: "۱ سال" },
              ]}
            />
          </div>
        )}
      </div>

      <Card>
        {isLoading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-10 w-10" />} title="داده‌ای برای این گزارش نیست" />
        ) : (
          <>
            <div className="border-b border-line px-4 py-2.5 text-[12px] text-ink-soft">
              {faNum(data.rows.length)} سطر
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                    {data.columns.map((c) => (
                      <th key={c.key} className="px-4 py-2.5 text-right font-medium">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-0 hover:bg-paper-soft/50">
                      {data.columns.map((c) => (
                        <td key={c.key} className="px-4 py-2.5">
                          {typeof r[c.key] === "number" ? faNum(r[c.key] as number) : (r[c.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
