"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SkeletonTable } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badges";
import { Wrench, Plus, Search } from "@/components/ui/icon";

interface MRow {
  id: string;
  status: string;
  problem: string;
  startDate: string;
  endDate: string | null;
  cost: string | null;
  technician: { fullName: string } | null;
  technicianName: string | null;
  asset: { id: string; code: string; name: string };
  _count: { parts: number };
}

const STATUS_FA: Record<string, string> = {
  OPEN: "ثبت‌شده", IN_PROGRESS: "در جریان", DONE: "انجام‌شده", CANCELLED: "لغوشده",
};
const STATUS_TONE: Record<string, string> = {
  OPEN: "badge-amber", IN_PROGRESS: "badge-blue", DONE: "badge-green", CANCELLED: "badge-gray",
};

function faDate(iso: string): string {
  try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(iso)); }
  catch { return iso; }
}

export default function MaintenancePage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [q, setQ] = useState("");

  // فرم ثبت تعمیر روی دارایی انتخابی
  const { data: assets } = useQuery({
    queryKey: ["assets-for-maint", q],
    queryFn: () => api<{ data: { id: string; code: string; name: string }[] }>(`/api/assets?pageSize=100${q ? `&q=${encodeURIComponent(q)}` : ""}`),
    enabled: modal,
  });
  const [assetId, setAssetId] = useState("");
  const [problem, setProblem] = useState("");
  const [technician, setTechnician] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["maintenances", statusFilter],
    queryFn: () => api<{ maintenances: MRow[] }>(`/api/maintenances${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  // اکشن‌های ردیف: شروع کار / تکمیل / لغو
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [cost, setCost] = useState("");
  const [returnTo, setReturnTo] = useState("AVAILABLE");

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/maintenances", {
        method: "POST",
        json: {
          assetId,
          problem,
          ...(technician ? { technicianName: technician } : {}),
        },
      });
      setModal(false); setAssetId(""); setProblem(""); setTechnician("");
      qc.invalidateQueries({ queryKey: ["maintenances"] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  async function doComplete() {
    if (!completeId) return;
    setBusy(true);
    try {
      await api(`/api/maintenances/${completeId}/complete`, {
        method: "POST",
        json: { returnTo, ...(cost ? { cost } : {}) },
      });
      setCompleteId(null); setCost("");
      qc.invalidateQueries({ queryKey: ["maintenances"] });
    } finally { setBusy(false); }
  }

  async function doCancel(id: string) {
    await api(`/api/maintenances/${id}`, { method: "PATCH", json: { status: "CANCELLED" } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["maintenances"] });
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">تعمیرات</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {data ? `${faNum(data.maintenances.length)} رکورد` : "…"}
          </p>
        </div>
        {can("maintenance:manage") && (
          <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" />ثبت تعمیر</Button>
        )}
      </div>

      <div className="mb-4 max-w-xs">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="همه وضعیت‌ها"
          options={Object.entries(STATUS_FA).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <Card>
        {isLoading ? <SkeletonTable rows={6} cols={6} /> : !data || data.maintenances.length === 0 ? (
          <EmptyState icon={<Wrench className="h-10 w-10" />} title="تعمیری ثبت نشده" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                  <th className="px-4 py-2.5 text-right font-medium">دارایی</th>
                  <th className="px-4 py-2.5 text-right font-medium">ایراد</th>
                  <th className="px-4 py-2.5 text-right font-medium">تعمیرکار</th>
                  <th className="px-4 py-2.5 text-right font-medium">شروع</th>
                  <th className="px-4 py-2.5 text-right font-medium">هزینه</th>
                  <th className="px-4 py-2.5 text-right font-medium">وضعیت</th>
                  {can("maintenance:manage") && <th className="px-4 py-2.5 text-left font-medium">عملیات</th>}
                </tr>
              </thead>
              <tbody>
                {data.maintenances.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0 hover:bg-paper-soft/50">
                    <td className="px-4 py-3">
                      <Link href={`/assets/${m.asset.id}`} className="font-medium hover:underline" dir="ltr">{m.asset.code}</Link>
                      <span className="text-ink-faint"> · {m.asset.name}</span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3">{m.problem}</td>
                    <td className="px-4 py-3 text-ink-soft">{m.technician?.fullName ?? m.technicianName ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{faDate(m.startDate)}</td>
                    <td className="px-4 py-3" dir="ltr">{m.cost ? faNum(Number(m.cost).toLocaleString("en-US")) : "—"}</td>
                    <td className="px-4 py-3"><span className={`badge ${STATUS_TONE[m.status]}`}>{STATUS_FA[m.status]}</span></td>
                    {can("maintenance:manage") && (
                      <td className="px-4 py-3 text-left">
                        {(m.status === "OPEN" || m.status === "IN_PROGRESS") && (
                          <div className="flex justify-end gap-1.5">
                            {m.status === "OPEN" && (
                              <Button size="sm" variant="ghost" onClick={async () => {
                                await api(`/api/maintenances/${m.id}`, { method: "PATCH", json: { status: "IN_PROGRESS" } });
                                qc.invalidateQueries({ queryKey: ["maintenances"] });
                              }}>شروع</Button>
                            )}
                            <Button size="sm" onClick={() => setCompleteId(m.id)}>تکمیل</Button>
                            <Button size="sm" variant="ghost" onClick={() => doCancel(m.id)}>لغو</Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* مودال ثبت تعمیر */}
      <Modal open={modal} onClose={() => setModal(false)} title="ثبت تعمیر جدید">
        <form onSubmit={submitNew} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">دارایی *</label>
            <div className="mb-2 flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3">
              <Search className="h-3.5 w-3.5 text-ink-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی دارایی…"
                className="w-full bg-transparent text-[12px] outline-none" />
            </div>
            <Select
              value={assetId}
              onChange={setAssetId}
              placeholder="انتخاب دارایی…"
              options={(assets?.data ?? []).map((a) => ({
                value: a.id, label: a.name, hint: a.code,
              }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" htmlFor="m-problem">شرح ایراد *</label>
            <textarea id="m-problem" rows={2} value={problem} onChange={(e) => setProblem(e.target.value)}
              className="w-full rounded-md border border-[#d9d9e0] px-3.5 py-2 text-[13px] outline-none focus:border-ink" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" htmlFor="m-tech">تعمیرکار (اختیاری)</label>
            <input id="m-tech" value={technician} onChange={(e) => setTechnician(e.target.value)}
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink" />
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button type="submit" loading={busy} disabled={!assetId || !problem}>ثبت و ارسال به تعمیر</Button>
          </div>
        </form>
      </Modal>

      {/* مودال تکمیل */}
      <Modal open={completeId !== null} onClose={() => setCompleteId(null)} title="تکمیل تعمیر">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">هزینه تعمیر (ریال)</label>
            <input dir="ltr" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="500000"
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-left text-[13px] outline-none focus:border-ink" />
            <p className="mt-1 text-[11px] text-ink-faint">هزینه قطعات ثبت‌شده خودکار جمع می‌شود</p>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">بازگشت دارایی به</label>
            <Select value={returnTo} onChange={setReturnTo}
              options={[
                { value: "AVAILABLE", label: "موجود (آزاد)" },
                { value: "IN_STOCK", label: "در انبار" },
              ]} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCompleteId(null)}>انصراف</Button>
            <Button loading={busy} onClick={doComplete}>تکمیل تعمیر</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
