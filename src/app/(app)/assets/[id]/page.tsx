"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Card, CardHeader, CardBody, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { StatusBadge, ConditionBadge, ASSET_STATUS_FA, ASSET_CONDITION_FA } from "@/components/ui/badges";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "@/components/ui/icon";
import { allowedTransitions, type AssetStatus } from "@/server/modules/asset-lifecycle";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AssignmentPanel } from "./assignment-panel";
import { QrPanel } from "./qr-panel";
import { MaintenanceButton } from "./maintenance-button";

interface AssetDetail {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: string;
  condition: string;
  purchasePrice: string | null;
  currency: string;
  notes: string | null;
  purchaseDate: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  createdAt: string;
  assetType: { name: string; code: string; category: { name: string; code: string } };
  createdBy: { fullName: string } | null;
  events: {
    id: string;
    type: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    occurredAt: string;
    actor: { fullName: string } | null;
  }[];
}

const EVENT_FA: Record<string, string> = {
  CREATED: "ایجاد",
  UPDATED: "ویرایش",
  STATUS_CHANGE: "تغییر وضعیت",
  ASSIGNED: "تحویل",
  RETURNED: "عودت",
  TRANSFERRED: "انتقال",
  MAINTENANCE: "تعمیر",
  REPAIRED: "تعمیر کامل",
  LOST: "گم‌شدن",
  RETIRED: "بازنشسته‌سازی",
  DISPOSED: "اسقاط",
  IN_STOCK: "ورود به انبار",
  AVAILABLE: "موجود",
  IN_USE: "شروع استفاده",
};

function faDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useAuth();
  const [changing, setChanging] = useState("");
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["asset", id],
    queryFn: () => api<{ asset: AssetDetail }>(`/api/assets/${id}`),
  });

  async function changeStatus(to: string) {
    setChanging(to);
    setTransitionError(null);
    try {
      await api(`/api/assets/${id}/status`, { method: "POST", json: { to } });
      router.refresh();
      // invalidate query
      window.location.reload();
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا";
      setTransitionError(msg);
    } finally {
      setChanging("");
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <SkeletonBlock className="h-8 w-64" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SkeletonBlock className="h-64 lg:col-span-2" />
          <SkeletonBlock className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <EmptyState title="دارایی یافت نشد" description="ممکن است حذف شده باشد" />
      </div>
    );
  }

  const a = data.asset;
  const nexts = allowedTransitions(a.status as AssetStatus);

  const rows: [string, React.ReactNode][] = [
    ["کد دارایی", <span key="c" dir="ltr" className="font-bold">{a.code}</span>],
    ["دسته / نوع", `${a.assetType.category.name} / ${a.assetType.name}`],
    ["برند / مدل", a.brand || a.model ? `${a.brand ?? "—"} ${a.model ?? ""}` : "—"],
    ["شماره سریال", a.serialNumber ? <span key="s" dir="ltr">{a.serialNumber}</span> : "—"],
    ["تاریخ خرید", a.purchaseDate ? faDate(a.purchaseDate) : "—"],
    ["قیمت خرید", a.purchasePrice ? `${faNum(Number(a.purchasePrice).toLocaleString("en-US"))} ${a.currency === "IRR" ? "ریال" : a.currency}` : "—"],
    ["گارانتی", a.warrantyEnd ? `تا ${faDate(a.warrantyEnd)}` : "—"],
    ["ثبت‌کننده", a.createdBy?.fullName ?? "—"],
    ["تاریخ ثبت", faDate(a.createdAt)],
  ];

  return (
    <div className="p-6">
      <Link href="/assets" className="mb-2 inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        دارایی‌ها
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{a.name}</h1>
        <span dir="ltr" className="rounded-md bg-paper-soft px-2 py-1 text-[12px] font-medium text-ink-soft">{a.code}</span>
        <StatusBadge status={a.status} />
        <ConditionBadge condition={a.condition} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="مشخصات" />
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2 border-b border-line/60 pb-2 text-[13px] last:border-0 sm:border-0">
                    <dt className="text-ink-soft">{k}</dt>
                    <dd className="text-left font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {a.notes && (
                <div className="mt-4 rounded-md bg-paper-soft p-3 text-[12px] text-ink-soft">{a.notes}</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="تاریخچه" subtitle={`${faNum(a.events.length)} رویداد`} />
            <CardBody className="p-0">
              {a.events.length === 0 ? (
                <EmptyState title="رویدادی ثبت نشده" />
              ) : (
                <ol className="relative space-y-0">
                  {a.events.map((ev, i) => (
                    <li key={ev.id} className="relative flex gap-3 px-5 py-3">
                      <div className="flex flex-col items-center">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-ink" />
                        {i < a.events.length - 1 && <span className="w-px flex-1 bg-line" />}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium">{EVENT_FA[ev.type] ?? ev.type}</span>
                          {ev.fromStatus && ev.toStatus && (
                            <span className="text-[11px] text-ink-faint">
                              {ASSET_STATUS_FA[ev.fromStatus]} ← {ASSET_STATUS_FA[ev.toStatus]}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-ink-faint">
                          {faDate(ev.occurredAt)} · {ev.actor?.fullName ?? "سیستم"}
                          {ev.note ? ` · ${ev.note}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <AssignmentPanel assetId={a.id} status={a.status} />
          <QrPanel assetId={a.id} code={a.code} />
          <MaintenanceButton assetId={a.id} status={a.status} />

          {can("asset:update") && nexts.length > 0 && (
            <Card>
              <CardHeader title="تغییر وضعیت" subtitle="گذارهای مجاز از وضعیت فعلی" />
              <CardBody className="space-y-3">
                <Select
                  value=""
                  placeholder="انتخاب وضعیت جدید…"
                  options={nexts.map((s) => ({ value: s, label: ASSET_STATUS_FA[s] }))}
                  onChange={(v) => changeStatus(v)}
                  disabled={Boolean(changing)}
                />
                {transitionError && (
                  <p className="text-[12px] text-red-600">{transitionError}</p>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="اطلاعات سریع" />
            <CardBody>
              <div className="space-y-2 text-[12px] text-ink-soft">
                <p>وضع ظاهری: <span className="font-medium text-ink">{ASSET_CONDITION_FA[a.condition]}</span></p>
                <p>چرخه عمر فعلی: <span className="font-medium text-ink">{EVENT_FA[a.status] ?? a.status}</span></p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
