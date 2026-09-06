"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SkeletonTable } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ShieldCheck, Plus } from "@/components/ui/icon";

interface AuditRow {
  id: string;
  code: string;
  title: string;
  scope: string;
  status: string;
  expectedTotal: number;
  createdAt: string;
  createdBy: { fullName: string };
  _count: { scans: number };
}

const STATUS_FA: Record<string, string> = { OPEN: "باز", CLOSED: "بسته" };

function faDate(iso: string): string {
  try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(iso)); }
  catch { return iso; }
}

export default function AuditsPage() {
  const { can } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", scope: "ALL", scopeId: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["audits"],
    queryFn: () => api<{ audits: AuditRow[] }>("/api/audits"),
  });

  const { data: depts } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<{ departments: { id: string; name: string }[] }>("/api/departments"),
    enabled: modal && form.scope === "DEPARTMENT",
  });
  const { data: locs } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api<{ locations: { id: string; name: string }[] }>("/api/locations"),
    enabled: modal && form.scope === "LOCATION",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await api<{ audit: { id: string } }>("/api/audits", {
        method: "POST",
        json: {
          title: form.title,
          scope: form.scope,
          ...(form.scope !== "ALL" && form.scopeId ? { scopeId: form.scopeId } : {}),
        },
      });
      setModal(false);
      setForm({ title: "", scope: "ALL", scopeId: "" });
      qc.invalidateQueries({ queryKey: ["audits"] });
      router.push(`/audits/${res.audit.id}`);
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">ممیزی موجودی</h1>
          <p className="mt-1 text-[13px] text-ink-soft">شمارش دوره‌ای با اسکن QR — مفقودی و مغایرت</p>
        </div>
        {can("audit:manage") && (
          <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" />ممیزی جدید</Button>
        )}
      </div>

      <Card>
        {isLoading ? <SkeletonTable rows={4} cols={5} /> : !data || data.audits.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="h-10 w-10" />} title="ممیزی ثبت نشده"
            description="اولین نشست شمارش را بسازید" />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <th className="px-4 py-2.5 text-right font-medium">کد</th>
                <th className="px-4 py-2.5 text-right font-medium">عنوان</th>
                <th className="px-4 py-2.5 text-right font-medium">محدوده</th>
                <th className="px-4 py-2.5 text-right font-medium">انتظار</th>
                <th className="px-4 py-2.5 text-right font-medium">اسکن</th>
                <th className="px-4 py-2.5 text-right font-medium">تاریخ</th>
                <th className="px-4 py-2.5 text-right font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {data.audits.map((a) => (
                <tr key={a.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-paper-soft/50"
                  onClick={() => router.push(`/audits/${a.id}`)}>
                  <td className="px-4 py-3 font-mono text-[12px]" dir="ltr">{a.code}</td>
                  <td className="px-4 py-3 font-medium">{a.title}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {a.scope === "ALL" ? "همه" : a.scope === "DEPARTMENT" ? "بخش" : "محل"}
                  </td>
                  <td className="px-4 py-3">{faNum(a.expectedTotal)}</td>
                  <td className="px-4 py-3">{faNum(a._count.scans)}</td>
                  <td className="px-4 py-3 text-ink-soft">{faDate(a.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${a.status === "OPEN" ? "badge-green" : "badge-gray"}`}>
                      {STATUS_FA[a.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="ممیزی جدید">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" htmlFor="aud-title">عنوان *</label>
            <input id="aud-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثلاً: شمارش پایان فصل پاییز"
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">محدوده</label>
            <Select value={form.scope} onChange={(v) => setForm({ ...form, scope: v, scopeId: "" })}
              options={[
                { value: "ALL", label: "همه دارایی‌ها" },
                { value: "DEPARTMENT", label: "یک بخش" },
                { value: "LOCATION", label: "یک محل" },
              ]} />
          </div>
          {form.scope === "DEPARTMENT" && (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">بخش</label>
              <Select value={form.scopeId} onChange={(v) => setForm({ ...form, scopeId: v })}
                placeholder="انتخاب بخش…"
                options={(depts?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} />
            </div>
          )}
          {form.scope === "LOCATION" && (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">محل</label>
              <Select value={form.scopeId} onChange={(v) => setForm({ ...form, scopeId: v })}
                placeholder="انتخاب محل…"
                options={(locs?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))} />
            </div>
          )}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button type="submit" loading={busy} disabled={form.title.trim().length < 3 || (form.scope !== "ALL" && !form.scopeId)}>
              شروع ممیزی
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
