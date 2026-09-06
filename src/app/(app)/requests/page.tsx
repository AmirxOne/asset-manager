"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SkeletonTable } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ScrollText, Plus } from "@/components/ui/icon";

interface ReqRow {
  id: string;
  code: string;
  title: string;
  reason: string | null;
  quantity: number;
  urgency: string;
  status: string;
  createdAt: string;
  requester: { fullName: string; personnelCode: string };
  department: { name: string } | null;
  assetType: { name: string; code: string } | null;
  approvals: { level: string; decision: string; note: string | null; approver: { fullName: string } }[];
  _count: { items: number };
}

const STATUS_FA: Record<string, string> = {
  PENDING: "در انتظار تأیید مدیر",
  MANAGER_APPROVED: "تأیید مدیر — در انتظار IT",
  IT_APPROVED: "تأیید IT — آماده تأمین",
  FULFILLED: "تأمین‌شده",
  REJECTED: "رد شده",
  CANCELLED: "لغو شده",
};
const STATUS_TONE: Record<string, string> = {
  PENDING: "badge-amber",
  MANAGER_APPROVED: "badge-blue",
  IT_APPROVED: "badge-blue",
  FULFILLED: "badge-green",
  REJECTED: "badge-red",
  CANCELLED: "badge-gray",
};
const URGENCY_FA: Record<string, string> = { LOW: "کم", NORMAL: "عادی", HIGH: "فوری" };

function faDate(iso: string): string {
  try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(iso)); }
  catch { return iso; }
}

export default function RequestsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", assetTypeId: "", quantity: "1", reason: "", urgency: "NORMAL" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const canViewAll = can("request:viewAll");
  const effectiveScope = canViewAll ? scope : "mine";

  const { data, isLoading } = useQuery({
    queryKey: ["requests", effectiveScope, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams({ scope: effectiveScope });
      if (statusFilter) p.set("status", statusFilter);
      return api<{ requests: ReqRow[]; hasEmployee?: boolean }>(`/api/requests?${p}`);
    },
  });

  const { data: types } = useQuery({
    queryKey: ["asset-types"],
    queryFn: () => api<{ types: { id: string; name: string; code: string }[] }>("/api/asset-types"),
    enabled: modal,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/requests", {
        method: "POST",
        json: {
          title: form.title,
          quantity: Number(form.quantity) || 1,
          urgency: form.urgency,
          ...(form.assetTypeId ? { assetTypeId: form.assetTypeId } : {}),
          ...(form.reason ? { reason: form.reason } : {}),
        },
      });
      setModal(false);
      setForm({ title: "", assetTypeId: "", quantity: "1", reason: "", urgency: "NORMAL" });
      qc.invalidateQueries({ queryKey: ["requests"] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  async function act(id: string, action: string, extra: object = {}) {
    setBusy(true);
    try {
      await api(`/api/requests/${id}/approve`, { method: "POST", json: { action, ...extra } });
      qc.invalidateQueries({ queryKey: ["requests"] });
      setRejectFor(null); setRejectNote("");
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  const label = "mb-1.5 block text-[12px] font-medium";

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">درخواست‌های دارایی</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            گردش: ثبت → تأیید مدیر بخش → تأیید IT → تأمین
          </p>
        </div>
        <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" />درخواست جدید</Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {canViewAll && (
          <div className="w-40">
            <Select value={scope} onChange={(v) => setScope(v as "mine" | "all")}
              options={[
                { value: "mine", label: "درخواست‌های من" },
                { value: "all", label: "همه درخواست‌ها" },
              ]} />
          </div>
        )}
        <div className="w-48">
          <Select value={statusFilter} onChange={setStatusFilter} placeholder="همه وضعیت‌ها"
            options={Object.entries(STATUS_FA).map(([value, l]) => ({ value, label: l }))} />
        </div>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>}

      <Card>
        {isLoading ? <SkeletonTable rows={6} cols={5} /> :
         data && data.hasEmployee === false ? (
          <EmptyState icon={<ScrollText className="h-10 w-10" />} title="حساب شما به پرونده پرسنلی متصل نیست"
            description="از مدیر دارایی بخواهید متصل کند" />
         ) : !data || data.requests.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-10 w-10" />} title="درخواستی نیست"
            description="اولین درخواست دارایی خود را ثبت کنید" />
         ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                  <th className="px-4 py-2.5 text-right font-medium">کد</th>
                  <th className="px-4 py-2.5 text-right font-medium">عنوان</th>
                  <th className="px-4 py-2.5 text-right font-medium">درخواست‌دهنده</th>
                  {effectiveScope === "all" && <th className="px-4 py-2.5 text-right font-medium">بخش</th>}
                  <th className="px-4 py-2.5 text-right font-medium">تعداد</th>
                  <th className="px-4 py-2.5 text-right font-medium">تاریخ</th>
                  <th className="px-4 py-2.5 text-right font-medium">وضعیت</th>
                  <th className="px-4 py-2.5 text-left font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper-soft/50">
                    <td className="px-4 py-3 font-mono text-[12px]" dir="ltr">{r.code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.title}</p>
                      {r.assetType && <p className="text-[11px] text-ink-faint">{r.assetType.name}</p>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{r.requester.fullName}</td>
                    {effectiveScope === "all" && <td className="px-4 py-3 text-ink-soft">{r.department?.name ?? "—"}</td>}
                    <td className="px-4 py-3">{faNum(r.quantity)}</td>
                    <td className="px-4 py-3 text-ink-soft">{faDate(r.createdAt)}</td>
                    <td className="px-4 py-3"><span className={`badge ${STATUS_TONE[r.status]}`}>{STATUS_FA[r.status]}</span></td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex justify-end gap-1.5">
                        {r.status === "PENDING" && can("request:approve:manager") && (
                          <>
                            <Button size="sm" loading={busy} onClick={() => act(r.id, "DECIDE", { decision: "APPROVED" })}>تأیید</Button>
                            <Button size="sm" variant="ghost" onClick={() => setRejectFor(r.id)}>رد</Button>
                          </>
                        )}
                        {r.status === "MANAGER_APPROVED" && can("request:approve:it") && (
                          <>
                            <Button size="sm" loading={busy} onClick={() => act(r.id, "DECIDE", { decision: "APPROVED" })}>تأیید IT</Button>
                            <Button size="sm" variant="ghost" onClick={() => setRejectFor(r.id)}>رد</Button>
                          </>
                        )}
                        {r.status === "IT_APPROVED" && can("request:fulfill") && (
                          <Button size="sm" variant="secondary" onClick={() => act(r.id, "FULFILL", { assetIds: [] }).catch(() => {})}>
                            تأمین
                          </Button>
                        )}
                        {["PENDING", "MANAGER_APPROVED", "IT_APPROVED"].includes(r.status) && r.requester.personnelCode && (
                          <Button size="sm" variant="ghost" onClick={() => act(r.id, "CANCEL")}>لغو</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* مودال ثبت */}
      <Modal open={modal} onClose={() => setModal(false)} title="درخواست دارایی جدید">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={label} htmlFor="req-title">عنوان *</label>
            <input id="req-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثلاً: مانیتور اضافه برای میز پشتیبانی"
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>نوع دارایی (اختیاری)</label>
              <Select value={form.assetTypeId} onChange={(v) => setForm({ ...form, assetTypeId: v })}
                placeholder="بدون نوع مشخص"
                options={(types?.types ?? []).map((t) => ({ value: t.id, label: t.name, hint: t.code }))} />
            </div>
            <div>
              <label className={label}>فوریت</label>
              <Select value={form.urgency} onChange={(v) => setForm({ ...form, urgency: v })}
                options={Object.entries(URGENCY_FA).map(([value, l]) => ({ value, label: l }))} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="req-qty">تعداد</label>
            <input id="req-qty" dir="ltr" type="number" min={1} max={50} value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-left text-[13px] outline-none focus:border-ink" />
          </div>
          <div>
            <label className={label} htmlFor="req-reason">دلیل (اختیاری)</label>
            <textarea id="req-reason" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full rounded-md border border-[#d9d9e0] px-3.5 py-2 text-[13px] outline-none focus:border-ink" />
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button type="submit" loading={busy} disabled={form.title.trim().length < 3}>ثبت درخواست</Button>
          </div>
        </form>
      </Modal>

      {/* مودال رد */}
      <Modal open={rejectFor !== null} onClose={() => setRejectFor(null)} title="رد درخواست">
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="rej-note">دلیل رد</label>
            <textarea id="rej-note" rows={2} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
              className="w-full rounded-md border border-[#d9d9e0] px-3.5 py-2 text-[13px] outline-none focus:border-ink" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectFor(null)}>انصراف</Button>
            <Button variant="danger" loading={busy}
              onClick={() => act(rejectFor!, "DECIDE", { decision: "REJECTED", note: rejectNote })}>
              رد درخواست
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
