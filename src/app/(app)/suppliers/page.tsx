"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SkeletonTable } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Briefcase, Plus } from "@/components/ui/icon";

interface SupRow {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  _count: { assets: number };
}

export default function SuppliersPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api<{ suppliers: SupRow[] }>("/api/suppliers?withPurchases=1"),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/suppliers", {
        method: "POST",
        json: {
          name: form.name,
          ...(form.contactName ? { contactName: form.contactName } : {}),
          ...(form.phone ? { phone: form.phone } : {}),
          ...(form.email ? { email: form.email } : {}),
        },
      });
      setModal(false);
      setForm({ name: "", contactName: "", phone: "", email: "" });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  const label = "mb-1.5 block text-[12px] font-medium";
  const inputCls = "h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink";

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">تأمین‌کنندگان</h1>
          <p className="mt-1 text-[13px] text-ink-soft">{data ? `${faNum(data.suppliers.length)} مورد` : "…"}</p>
        </div>
        {can("supplier:manage") && (
          <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" />تأمین‌کننده جدید</Button>
        )}
      </div>

      <Card>
        {isLoading ? <SkeletonTable rows={5} cols={5} /> : !data || data.suppliers.length === 0 ? (
          <EmptyState icon={<Briefcase className="h-10 w-10" />} title="تأمین‌کننده‌ای ثبت نشده" />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <th className="px-4 py-2.5 text-right font-medium">نام</th>
                <th className="px-4 py-2.5 text-right font-medium">رابط</th>
                <th className="px-4 py-2.5 text-right font-medium">تلفن</th>
                <th className="px-4 py-2.5 text-right font-medium">ایمیل</th>
                <th className="px-4 py-2.5 text-right font-medium">تعداد خرید</th>
              </tr>
            </thead>
            <tbody>
              {data.suppliers.map((s) => (
                <tr key={s.id} className={`border-b border-line last:border-0 hover:bg-paper-soft/50 ${!s.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{s.contactName ?? "—"}</td>
                  <td className="px-4 py-3" dir="ltr">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft" dir="ltr">{s.email ?? "—"}</td>
                  <td className="px-4 py-3">{faNum(s._count.assets)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="تأمین‌کننده جدید">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={label} htmlFor="sup-name">نام *</label>
            <input id="sup-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="sup-contact">نام رابط</label>
              <input id="sup-contact" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className={label} htmlFor="sup-phone">تلفن</label>
              <input id="sup-phone" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`${inputCls} text-left`} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="sup-email">ایمیل</label>
            <input id="sup-email" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={`${inputCls} text-left`} />
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button type="submit" loading={busy} disabled={!form.name}>ثبت</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
