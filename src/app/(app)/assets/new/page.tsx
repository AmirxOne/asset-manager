"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { FaInput } from "@/components/ui/fa-input";
import { ASSET_STATUS_FA, ASSET_CONDITION_FA } from "@/components/ui/badges";
import { ArrowLeft } from "@/components/ui/icon";

interface Option { id: string; name: string; code: string }

export default function NewAssetPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    assetTypeId: "",
    brand: "",
    model: "",
    serialNumber: "",
    purchaseDate: "",
    purchasePrice: "",
    warrantyStart: "",
    warrantyEnd: "",
    condition: "GOOD",
    status: "IN_STOCK",
    notes: "",
    code: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ categories: Option[] }>("/api/categories"),
  });
  const { data: typesData } = useQuery({
    queryKey: ["asset-types"],
    queryFn: () => api<{ types: (Option & { category: { name: string; code: string } })[] }>("/api/asset-types"),
  });

  const types = (typesData?.types ?? []);
  const selectedType = types.find((t) => t.id === form.assetTypeId);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        assetTypeId: form.assetTypeId,
        condition: form.condition,
        status: form.status,
      };
      if (form.brand.trim()) payload.brand = form.brand.trim();
      if (form.model.trim()) payload.model = form.model.trim();
      if (form.serialNumber.trim()) payload.serialNumber = form.serialNumber.trim();
      if (form.purchaseDate) payload.purchaseDate = form.purchaseDate;
      if (form.purchasePrice.trim()) payload.purchasePrice = form.purchasePrice.trim();
      if (form.warrantyStart) payload.warrantyStart = form.warrantyStart;
      if (form.warrantyEnd) payload.warrantyEnd = form.warrantyEnd;
      if (form.notes.trim()) payload.notes = form.notes.trim();
      if (form.code.trim()) payload.code = form.code.trim().toUpperCase();

      const res = await api<{ asset: { id: string; code: string } }>("/api/assets", {
        method: "POST",
        json: payload,
      });
      router.push(`/assets/${res.asset.id}?created=1`);
    } catch (err) {
      const e = err as ApiError;
      if (e?.status) {
        setError(e.message);
        if (e.extra && typeof e.extra === "object") setFieldErrors(e.extra as Record<string, string[]>);
      } else {
        setError("خطا در ثبت دارایی");
      }
    } finally {
      setSaving(false);
    }
  }

  const err = (k: string) =>
    fieldErrors[k] ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors[k][0]}</p> : null;

  const label = "mb-1.5 block text-[12px] font-medium";

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/assets" className="mb-2 inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          بازگشت به دارایی‌ها
        </Link>
        <h1 className="text-xl font-bold">ثبت دارایی جدید</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          کد دارایی به‌صورت خودکار ساخته می‌شود — یا کد دستی وارد کنید
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ستون اصلی */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="مشخصات اصلی" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="asset-name">نام دارایی *</label>
                  <input
                    id="asset-name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="مثلاً: لپ‌تاپ مدیرعامل"
                    className="h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(13,13,13,0.08)]"
                  />
                  {err("name")}
                </div>
                <div>
                  <label className={label} htmlFor="asset-code">کد دستی (اختیاری)</label>
                  <input
                    id="asset-code"
                    dir="ltr"
                    value={form.code}
                    onChange={(e) => set("code", e.target.value)}
                    placeholder="AST-IT-LAP-000001"
                    className="h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-left text-[13px] outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(13,13,13,0.08)]"
                  />
                  {err("code")}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>نوع دارایی *</label>
                  <Select
                    value={form.assetTypeId}
                    onChange={(v) => set("assetTypeId", v)}
                    placeholder="انتخاب نوع…"
                    options={types.map((t) => ({
                      value: t.id,
                      label: t.name,
                      hint: `${t.category.name} (${t.category.code}-${t.code})`,
                    }))}
                  />
                  {err("assetTypeId")}
                </div>
                <div>
                  <label className={label}>کد پیشنهادی خودکار</label>
                  <div className="flex h-11 items-center rounded-md border border-dashed border-line bg-paper-soft px-3.5 text-[13px] text-ink-faint" dir="ltr">
                    {selectedType
                      ? `AST-${selectedType.category.code}-${selectedType.code}-…`
                      : "بعد از انتخاب نوع"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="asset-brand">برند</label>
                  <input
                    id="asset-brand"
                    value={form.brand}
                    onChange={(e) => set("brand", e.target.value)}
                    placeholder="مثلاً: Lenovo"
                    className="h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none focus:border-ink"
                  />
                </div>
                <div>
                  <label className={label} htmlFor="asset-model">مدل</label>
                  <input
                    id="asset-model"
                    value={form.model}
                    onChange={(e) => set("model", e.target.value)}
                    placeholder="مثلاً: ThinkPad T14"
                    className="h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none focus:border-ink"
                  />
                </div>
              </div>

              <div>
                <label className={label} htmlFor="asset-serial">شماره سریال (در صورت وجود یکتاست)</label>
                <input
                  id="asset-serial"
                  dir="ltr"
                  value={form.serialNumber}
                  onChange={(e) => set("serialNumber", e.target.value)}
                  className="h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-left text-[13px] outline-none focus:border-ink"
                />
                {err("serialNumber")}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="خرید و گارانتی" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>تاریخ خرید</label>
                  <JalaliDatePicker value={form.purchaseDate} onChange={(v) => set("purchaseDate", v)} />
                </div>
                <div>
                  <label className={label}>قیمت خرید (ریال)</label>
                  <FaInput
                    allow="decimal"
                    value={form.purchasePrice}
                    onChange={(v) => set("purchasePrice", v)}
                    placeholder="۵۰۰۰۰۰۰۰"
                    className="h-11 w-full"
                    aria-label="قیمت خرید"
                  />
                  {err("purchasePrice")}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>شروع گارانتی</label>
                  <JalaliDatePicker value={form.warrantyStart} onChange={(v) => set("warrantyStart", v)} />
                </div>
                <div>
                  <label className={label}>پایان گارانتی</label>
                  <JalaliDatePicker value={form.warrantyEnd} onChange={(v) => set("warrantyEnd", v)} />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="یادداشت" />
            <CardBody>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-[#d9d9e0] px-3.5 py-2.5 text-[13px] outline-none focus:border-ink"
                placeholder="توضیحات، لوازمی که همراهش تحویل شده و…"
              />
            </CardBody>
          </Card>
        </div>

        {/* ستون کنار */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="وضعیت اولیه" />
            <CardBody className="space-y-4">
              <div>
                <label className={label}>وضعیت</label>
                <Select
                  value={form.status}
                  onChange={(v) => set("status", v)}
                  options={Object.entries(ASSET_STATUS_FA)
                    .filter(([v]) => ["IN_STOCK", "AVAILABLE"].includes(v))
                    .map(([value, label]) => ({ value, label }))}
                />
              </div>
              <div>
                <label className={label}>وضع ظاهری</label>
                <Select
                  value={form.condition}
                  onChange={(v) => set("condition", v)}
                  options={Object.entries(ASSET_CONDITION_FA).map(([value, label]) => ({ value, label }))}
                />
              </div>
            </CardBody>
          </Card>

          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>
          )}

          <div className="flex gap-2">
            <Button type="submit" loading={saving} className="flex-1">
              ثبت دارایی
            </Button>
            <Link href="/assets">
              <Button type="button" variant="outline">انصراف</Button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
