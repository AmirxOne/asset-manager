"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SkeletonTable } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Plus, Building2 } from "@/components/ui/icon";

interface Dept { id: string; name: string; code: string | null; description: string | null; _count: { employees: number } }

export default function DepartmentsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<{ departments: Dept[] }>("/api/departments"),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api("/api/departments", {
        method: "POST",
        json: { name: form.name, ...(form.code ? { code: form.code.toUpperCase() } : {}), ...(form.description ? { description: form.description } : {}) },
      });
      setModal(false); setForm({ name: "", code: "", description: "" });
      qc.invalidateQueries({ queryKey: ["departments"] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setSaving(false); }
  }

  const label = "mb-1.5 block text-[12px] font-medium";

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">بخش‌ها</h1>
          <p className="mt-1 text-[13px] text-ink-soft">{data ? `${faNum(data.departments.length)} بخش` : "…"}</p>
        </div>
        {can("department:manage") && (
          <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" />بخش جدید</Button>
        )}
      </div>

      <Card>
        {isLoading ? <SkeletonTable rows={5} cols={3} /> : !data || data.departments.length === 0 ? (
          <EmptyState icon={<Building2 className="h-10 w-10" />} title="بخشی ثبت نشده" description="اولین بخش سازمانی را بسازید" />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <th className="px-4 py-2.5 text-right font-medium">نام</th>
                <th className="px-4 py-2.5 text-right font-medium">کد</th>
                <th className="px-4 py-2.5 text-right font-medium">تعداد کارمند</th>
              </tr>
            </thead>
            <tbody>
              {data.departments.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0 hover:bg-paper-soft/50">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3" dir="ltr">{d.code ?? "—"}</td>
                  <td className="px-4 py-3">{faNum(d._count.employees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="بخش جدید">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={label} htmlFor="dept-name">نام بخش *</label>
            <input id="dept-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثلاً: فناوری اطلاعات" className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink" />
          </div>
          <div>
            <label className={label} htmlFor="dept-code">کد (اختیاری)</label>
            <input id="dept-code" dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="IT" className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-left text-[13px] outline-none focus:border-ink" />
          </div>
          <div>
            <label className={label} htmlFor="dept-desc">توضیحات</label>
            <textarea id="dept-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-[#d9d9e0] px-3.5 py-2 text-[13px] outline-none focus:border-ink" />
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button type="submit" loading={saving}>ثبت بخش</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
