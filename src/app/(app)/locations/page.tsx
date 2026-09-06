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
import { Plus, MapPin } from "@/components/ui/icon";

interface Loc { id: string; name: string; code: string | null; type: string; address: string | null; parent: { name: string } | null }

const TYPE_FA: Record<string, string> = {
  BUILDING: "ساختمان", FLOOR: "طبقه", ROOM: "اتاق", WAREHOUSE: "انبار", BRANCH: "شعبه",
};
const TYPE_TONE: Record<string, string> = {
  BUILDING: "badge-black", FLOOR: "badge-gray", ROOM: "badge-blue", WAREHOUSE: "badge-amber", BRANCH: "badge-green",
};

export default function LocationsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", type: "ROOM", parentId: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api<{ locations: Loc[] }>("/api/locations"),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api("/api/locations", {
        method: "POST",
        json: {
          name: form.name, type: form.type,
          ...(form.code ? { code: form.code.toUpperCase() } : {}),
          ...(form.parentId ? { parentId: form.parentId } : {}),
          ...(form.address ? { address: form.address } : {}),
        },
      });
      setModal(false); setForm({ name: "", code: "", type: "ROOM", parentId: "", address: "" });
      qc.invalidateQueries({ queryKey: ["locations"] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setSaving(false); }
  }

  const label = "mb-1.5 block text-[12px] font-medium";

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">محل‌ها</h1>
          <p className="mt-1 text-[13px] text-ink-soft">{data ? `${faNum(data.locations.length)} محل` : "…"}</p>
        </div>
        {can("location:manage") && (
          <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" />محل جدید</Button>
        )}
      </div>

      <Card>
        {isLoading ? <SkeletonTable rows={5} cols={4} /> : !data || data.locations.length === 0 ? (
          <EmptyState icon={<MapPin className="h-10 w-10" />} title="محلی ثبت نشده" description="ساختمان، طبقه، اتاق یا انبار بسازید" />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <th className="px-4 py-2.5 text-right font-medium">نام</th>
                <th className="px-4 py-2.5 text-right font-medium">نوع</th>
                <th className="px-4 py-2.5 text-right font-medium">والد</th>
                <th className="px-4 py-2.5 text-right font-medium">کد</th>
              </tr>
            </thead>
            <tbody>
              {data.locations.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0 hover:bg-paper-soft/50">
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${TYPE_TONE[l.type] ?? "badge-gray"}`}>{TYPE_FA[l.type] ?? l.type}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{l.parent?.name ?? "—"}</td>
                  <td className="px-4 py-3" dir="ltr">{l.code ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="محل جدید">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={label} htmlFor="loc-name">نام *</label>
            <input id="loc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثلاً: انبار مرکزی" className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>نوع *</label>
              <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })}
                options={Object.entries(TYPE_FA).map(([value, l]) => ({ value, label: l }))} />
            </div>
            <div>
              <label className={label}>محل والد</label>
              <Select value={form.parentId} onChange={(v) => setForm({ ...form, parentId: v })}
                placeholder="بدون والد"
                options={(data?.locations ?? []).map((l) => ({ value: l.id, label: l.name, hint: TYPE_FA[l.type] }))} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="loc-code">کد (اختیاری)</label>
            <input id="loc-code" dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="WH-01" className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-left text-[13px] outline-none focus:border-ink" />
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button type="submit" loading={saving}>ثبت محل</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
