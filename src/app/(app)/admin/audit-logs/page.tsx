"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { Card, EmptyState, SkeletonTable } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { History, ChevronRight, ChevronLeft } from "@/components/ui/icon";

interface LogRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ip: string | null;
  createdAt: string;
  actor: { fullName: string; email: string } | null;
}

interface LogsData {
  logs: LogRow[];
  total: number;
  page: number;
  pageCount: number;
  filters: {
    actions: { value: string; count: number }[];
    entities: { value: string; count: number }[];
  };
}

const ACTION_FA: Record<string, string> = {
  CREATE: "ایجاد", UPDATE: "ویرایش", DELETE: "حذف", ASSIGN: "تحویل", RETURN: "عودت",
  TRANSFER: "انتقال", MAINTENANCE: "تعمیر", STATUS_CHANGE: "تغییر وضعیت", AUDIT: "ممیزی",
  LOGIN: "ورود", LOGOUT: "خروج", BULK: "عملیات گروهی",
};
const ACTION_TONE: Record<string, string> = {
  CREATE: "badge-green", UPDATE: "badge-blue", DELETE: "badge-red", ASSIGN: "badge-blue",
  RETURN: "badge-amber", TRANSFER: "badge-purple", MAINTENANCE: "badge-amber",
  STATUS_CHANGE: "badge-gray", AUDIT: "badge-purple", LOGIN: "badge-gray", LOGOUT: "badge-gray",
};

const ENTITY_FA: Record<string, string> = {
  Asset: "دارایی", User: "کاربر", Employee: "کارمند", Department: "بخش", Location: "محل",
  Supplier: "تأمین‌کننده", MaintenanceRecord: "تعمیر", AssetRequest: "درخواست",
  AuditSession: "ممیزی", Category: "دسته", AssetType: "نوع دارایی", Session: "نشست",
};

function faTime(iso: string): string {
  try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso)); }
  catch { return iso; }
}

export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<LogRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", action, entity, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: "30" });
      if (action) p.set("action", action);
      if (entity) p.set("entity", entity);
      return api<LogsData>(`/api/audit-logs?${p}`);
    },
  });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold">لاگ عملیات</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {data ? `${faNum(data.total)} رکورد` : "هر عملیات مهم با بازیگر و زمان ثبت می‌شود"}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-48">
          <Select value={action} onChange={(v) => { setAction(v); setPage(1); }} placeholder="همه عملیات"
            options={(data?.filters.actions ?? []).map((a) => ({
              value: a.value, label: `${ACTION_FA[a.value] ?? a.value} (${a.count})`,
            }))} />
        </div>
        <div className="w-48">
          <Select value={entity} onChange={(v) => { setEntity(v); setPage(1); }} placeholder="همه موجودیت‌ها"
            options={(data?.filters.entities ?? []).map((e) => ({
              value: e.value, label: `${ENTITY_FA[e.value] ?? e.value} (${e.count})`,
            }))} />
        </div>
      </div>

      <Card>
        {isLoading ? <SkeletonTable rows={10} cols={5} /> : !data || data.logs.length === 0 ? (
          <EmptyState icon={<History className="h-10 w-10" />} title="لاگی نیست" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                    <th className="px-4 py-2.5 text-right font-medium">عملیات</th>
                    <th className="px-4 py-2.5 text-right font-medium">موجودیت</th>
                    <th className="px-4 py-2.5 text-right font-medium">بازیگر</th>
                    <th className="px-4 py-2.5 text-right font-medium">IP</th>
                    <th className="px-4 py-2.5 text-right font-medium">زمان</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((l) => (
                    <tr key={l.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-paper-soft/50"
                      onClick={() => setDetail(l)}>
                      <td className="px-4 py-2.5">
                        <span className={`badge ${ACTION_TONE[l.action] ?? "badge-gray"}`}>
                          {ACTION_FA[l.action] ?? l.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft">{ENTITY_FA[l.entity] ?? l.entity}</td>
                      <td className="px-4 py-2.5">{l.actor?.fullName ?? "سیستم"}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-ink-faint" dir="ltr">{l.ip ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[12px] text-ink-soft">{faTime(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* صفحه‌بندی */}
            {data.pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />قبلی
                </Button>
                <span className="text-[12px] text-ink-soft">صفحه {faNum(data.page)} از {faNum(data.pageCount)}</span>
                <Button size="sm" variant="outline" disabled={page >= data.pageCount} onClick={() => setPage(page + 1)}>
                  بعدی<ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* جزئیات یک لاگ */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetail(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-md bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-[14px] font-bold">
              {ACTION_FA[detail.action] ?? detail.action} — {ENTITY_FA[detail.entity] ?? detail.entity}
            </p>
            <p className="mb-4 text-[12px] text-ink-soft">
              {detail.actor?.fullName} · {faTime(detail.createdAt)} · {detail.ip ?? "بدون IP"}
            </p>
            {detail.oldValue ? (
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-medium text-ink-soft">قبل:</p>
                <pre className="overflow-x-auto rounded-md bg-red-50 p-3 text-left text-[11px]" dir="ltr">
{JSON.stringify(detail.oldValue, null, 2)}
                </pre>
              </div>
            ) : null}
            {detail.newValue ? (
              <div>
                <p className="mb-1 text-[11px] font-medium text-ink-soft">بعد:</p>
                <pre className="overflow-x-auto rounded-md bg-emerald-50 p-3 text-left text-[11px]" dir="ltr">
{JSON.stringify(detail.newValue, null, 2)}
                </pre>
              </div>
            ) : null}
            {!detail.oldValue && !detail.newValue && (
              <p className="text-[12px] text-ink-faint">جزئیات تغییر ثبت نشده</p>
            )}
            <Button variant="outline" className="mt-4 w-full" onClick={() => setDetail(null)}>بستن</Button>
          </div>
        </div>
      )}
    </div>
  );
}
