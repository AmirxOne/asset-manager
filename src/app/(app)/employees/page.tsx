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
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatusBadge } from "@/components/ui/badges";
import { Plus, Search, Users } from "@/components/ui/icon";

interface EmployeeRow {
  id: string;
  fullName: string;
  personnelCode: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  department: { name: string } | null;
  _count: { heldAssets: number };
}

export default function EmployeesPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ fullName: "", personnelCode: "", departmentId: "", position: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: depts } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<{ departments: { id: string; name: string }[] }>("/api/departments"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["employees", q],
    queryFn: () => api<{ employees: EmployeeRow[] }>(`/api/employees?q=${encodeURIComponent(q)}`),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/employees", {
        method: "POST",
        json: {
          fullName: form.fullName,
          personnelCode: form.personnelCode,
          ...(form.departmentId ? { departmentId: form.departmentId } : {}),
          ...(form.position ? { position: form.position } : {}),
          ...(form.email ? { email: form.email } : {}),
          ...(form.phone ? { phone: form.phone } : {}),
        },
      });
      setModal(false);
      setForm({ fullName: "", personnelCode: "", departmentId: "", position: "", email: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["employees"] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally {
      setSaving(false);
    }
  }

  const label = "mb-1.5 block text-[12px] font-medium";

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">کارمندان</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {data ? `${faNum(data.employees.length)} نفر` : "در حال بارگذاری…"}
          </p>
        </div>
        {can("employee:manage") && (
          <Button onClick={() => setModal(true)}>
            <Plus className="h-4 w-4" />
            کارمند جدید
          </Button>
        )}
      </div>

      <div className="mb-4 flex h-10 max-w-md items-center gap-2 rounded-md border border-line bg-white px-3">
        <Search className="h-4 w-4 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی نام، کد پرسنلی، سمت…"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
        />
      </div>

      <Card>
        {isLoading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : !data || data.employees.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="کارمندی یافت نشد"
            description={q ? "جستجو را تغییر دهید" : "اولین کارمند را ثبت کنید"}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                  <th className="px-4 py-2.5 text-right font-medium">نام</th>
                  <th className="px-4 py-2.5 text-right font-medium">کد پرسنلی</th>
                  <th className="px-4 py-2.5 text-right font-medium">بخش</th>
                  <th className="px-4 py-2.5 text-right font-medium">سمت</th>
                  <th className="px-4 py-2.5 text-right font-medium">دارایی فعال</th>
                  <th className="px-4 py-2.5 text-right font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-paper-soft/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={e.fullName} size="sm" variant="ink" />
                        <span className="font-medium">{e.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" dir="ltr">{e.personnelCode}</td>
                    <td className="px-4 py-3 text-ink-soft">{e.department?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{e.position ?? "—"}</td>
                    <td className="px-4 py-3">{e._count.heldAssets > 0 ? faNum(e._count.heldAssets) : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="کارمند جدید">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={label} htmlFor="emp-name">نام و نام خانوادگی *</label>
            <input id="emp-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="emp-code">کد پرسنلی *</label>
              <input id="emp-code" dir="ltr" value={form.personnelCode} onChange={(e) => setForm({ ...form, personnelCode: e.target.value })}
                placeholder="EMP-001" className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-left text-[13px] outline-none focus:border-ink" />
            </div>
            <div>
              <label className={label}>بخش</label>
              <Select value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })}
                placeholder="انتخاب…"
                options={(depts?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="emp-pos">سمت</label>
            <input id="emp-pos" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="emp-email">ایمیل</label>
              <input id="emp-email" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-left text-[13px] outline-none focus:border-ink" />
            </div>
            <div>
              <label className={label} htmlFor="emp-phone">تلفن</label>
              <input id="emp-phone" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-left text-[13px] outline-none focus:border-ink" />
            </div>
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button type="submit" loading={saving}>ثبت کارمند</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
