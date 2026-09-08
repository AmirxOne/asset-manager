"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SkeletonTable } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Users, UserPlus } from "@/components/ui/icon";

interface URow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  roles: { role: { id: string; key: string; name: string } }[];
  employee: { fullName: string; personnelCode: string } | null;
}

interface RolesData {
  roles: { id: string; key: string; name: string }[];
}

function faDate(iso: string | null): string {
  if (!iso) return "—";
  try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short" }).format(new Date(iso)); }
  catch { return iso; }
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<URow | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", roleKey: "employee", employeeId: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<{ users: URow[] }>("/api/admin/users"),
  });
  const { data: rolesData } = useQuery({
    queryKey: ["admin-roles-lite"],
    queryFn: () => api<RolesData>("/api/admin/roles"),
    enabled: modal || edit !== null,
  });
  const { data: emps } = useQuery({
    queryKey: ["employees-options"],
    queryFn: () => api<{ employees: { id: string; fullName: string; personnelCode: string }[] }>("/api/employees?options=1"),
    enabled: modal,
  });

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/admin/users", {
        method: "POST",
        json: {
          fullName: form.fullName,
          email: form.email,
          ...(form.phone ? { phone: form.phone } : {}),
          password: form.password,
          roleKeys: [form.roleKey],
          ...(form.employeeId ? { employeeId: form.employeeId } : {}),
        },
      });
      setModal(false);
      setForm({ fullName: "", email: "", phone: "", password: "", roleKey: "employee", employeeId: "" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  async function toggleActive(u: URow) {
    setError(null);
    try {
      await api(`/api/admin/users/${u.id}`, { method: "PATCH", json: { isActive: !u.isActive } });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    }
  }

  const label = "mb-1.5 block text-[12px] font-medium";
  const input = "h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink";

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">کاربران</h1>
          <p className="mt-1 text-[13px] text-ink-soft">{data ? `${faNum(data.users.length)} کاربر` : "…"}</p>
        </div>
        <Button onClick={() => setModal(true)}><UserPlus className="h-4 w-4" />کاربر جدید</Button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>}

      <Card>
        {isLoading ? <SkeletonTable rows={6} cols={5} /> : !data || data.users.length === 0 ? (
          <EmptyState icon={<Users className="h-10 w-10" />} title="کاربری نیست" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                  <th className="px-4 py-2.5 text-right font-medium">نام</th>
                  <th className="px-4 py-2.5 text-right font-medium">ایمیل</th>
                  <th className="px-4 py-2.5 text-right font-medium">نقش‌ها</th>
                  <th className="px-4 py-2.5 text-right font-medium">آخرین ورود</th>
                  <th className="px-4 py-2.5 text-right font-medium">وضعیت</th>
                  <th className="px-4 py-2.5 text-left font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className={`border-b border-line last:border-0 hover:bg-paper-soft/50 ${!u.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.fullName}</p>
                      {u.employee && <p className="text-[11px] text-ink-faint">پرونده: {u.employee.fullName}</p>}
                    </td>
                    <td className="px-4 py-3" dir="ltr">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.isSuperAdmin && <span className="badge badge-red">ابرمدیر</span>}
                        {u.roles.map((r) => (
                          <span key={r.role.id} className="badge badge-gray">{r.role.name}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{faDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.isActive ? "badge-green" : "badge-gray"}`}>
                        {u.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      {!u.isSuperAdmin && (
                        <Button size="sm" variant={u.isActive ? "ghost" : "secondary"} onClick={() => toggleActive(u)}>
                          {u.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="کاربر جدید">
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <label className={label} htmlFor="u-name">نام و نام خانوادگی *</label>
            <input id="u-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="u-email">ایمیل *</label>
              <input id="u-email" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${input} text-left`} />
            </div>
            <div>
              <label className={label} htmlFor="u-phone">تلفن</label>
              <input id="u-phone" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${input} text-left`} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="u-pass">رمز عبور *</label>
            <input id="u-pass" dir="ltr" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${input} text-left`} />
          </div>
          <div>
            <label className={label}>نقش *</label>
            <Select value={form.roleKey} onChange={(v) => setForm({ ...form, roleKey: v })}
              options={(rolesData?.roles ?? []).map((r) => ({ value: r.key, label: r.name }))} />
          </div>
          <div>
            <label className={label}>اتصال به پرونده پرسنلی (اختیاری)</label>
            <Select value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })}
              placeholder="بدون اتصال"
              options={(emps?.employees ?? []).map((e) => ({ value: e.id, label: e.fullName, hint: e.personnelCode }))} />
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button type="submit" loading={busy} disabled={!form.fullName || !form.email || form.password.length < 8}>ثبت کاربر</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
