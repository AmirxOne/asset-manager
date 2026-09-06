"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { ASSET_STATUS_FA } from "@/components/ui/badges";
import { House, Wrench } from "@/components/ui/icon";

interface DashData {
  stats: {
    total: number;
    status: Record<string, number>;
    broken: number;
    totalValue: string;
    warrantyExpiring: number;
    openRequests: number;
    maintenanceOpen: number;
  };
  recentEvents: { id: string; type: string; note: string | null; createdAt: string; asset: { id: string; code: string; name: string }; actor: string }[];
  recentAssignments: { id: string; assignedAt: string; asset: { id: string; code: string; name: string }; employee: { fullName: string } }[];
  openRequests: { id: string; code: string; title: string; status: string; createdAt: string; requester: string }[];
}

const EVENT_FA: Record<string, string> = {
  CREATED: "ثبت", UPDATED: "ویرایش", STATUS_CHANGE: "تغییر وضعیت", ASSIGNED: "تحویل",
  RETURNED: "عودت", TRANSFERRED: "انتقال", MAINTENANCE: "تعمیر", REPAIRED: "تعمیر‌شده",
  RETIRED: "بازنشسته", AUDIT: "ممیزی", BULK: "گروهی",
};

function faTime(iso: string): string {
  try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso)); }
  catch { return iso; }
}

export default function DashboardPage() {
  const { can } = useAuth();
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashData["stats"] extends never ? never : DashData>("/api/dashboard"),
    enabled: can("dashboard:view"),
    refetchInterval: 60_000,
  });

  if (!can("dashboard:view")) {
    return (
      <div className="p-6">
        <Card><CardBody>
          <p className="py-8 text-center text-[14px] text-ink-soft">
            برای دیدن داشبورد دسترسی ندارید. <Link href="/my-assets" className="text-ink underline">دارایی‌های من</Link>
          </p>
        </CardBody></Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-24" />)}
        </div>
        <SkeletonBlock className="mt-4 h-64" />
      </div>
    );
  }

  const s = data.stats;
  const cards = [
    { label: "کل دارایی‌ها", value: faNum(s.total), href: "/assets", cls: "text-ink" },
    { label: "در اختیار", value: faNum((s.status.ASSIGNED ?? 0) + (s.status.IN_USE ?? 0)), href: "/assets?status=ASSIGNED", cls: "text-blue-600" },
    { label: "موجود", value: faNum(s.status.AVAILABLE ?? 0), href: "/assets?status=AVAILABLE", cls: "text-emerald-600" },
    { label: "در تعمیر", value: faNum(s.status.MAINTENANCE ?? 0), href: "/maintenance", cls: "text-amber-600" },
    { label: "مفقود", value: faNum(s.status.LOST ?? 0), href: "/assets?status=LOST", cls: "text-red-600" },
    { label: "بازنشسته", value: faNum(s.status.RETIRED ?? 0), href: "/assets?status=RETIRED", cls: "text-ink-soft" },
    { label: "گارانتی در حال انقضا", value: faNum(s.warrantyExpiring), href: "/reports?type=warranty_expiration", cls: "text-purple-600" },
    { label: "ارزش کل (ریال)", value: faNum(Number(s.totalValue).toLocaleString("en-US")), href: "/reports?type=asset_value", cls: "text-ink" },
  ];

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <House className="h-5 w-5 text-ink-soft" />
        <div>
          <h1 className="text-xl font-bold">داشبورد</h1>
          <p className="text-[12px] text-ink-soft">نمای کلی دارایی‌های سازمان</p>
        </div>
      </div>

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="px-4 py-3.5">
                <p className={`text-[22px] font-bold leading-7 ${c.cls}`}>{c.value}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">{c.label}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* ردیف پایین: رویدادها + تحویل‌ها + درخواست‌ها */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="آخرین رویدادها" subtitle="تاریخچه زنده" />
          <CardBody className="!p-0">
            <div className="max-h-80 overflow-y-auto">
              {data.recentEvents.map((e) => (
                <Link key={e.id} href={`/assets/${e.asset.id}`}
                  className="flex items-start gap-2 border-b border-line px-4 py-2.5 last:border-0 hover:bg-paper-soft/50">
                  <span className="mt-0.5 badge badge-gray shrink-0">{EVENT_FA[e.type] ?? e.type}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{e.asset.name}</p>
                    <p className="truncate text-[11px] text-ink-faint">
                      <span className="font-mono" dir="ltr">{e.asset.code}</span> · {e.actor}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-ink-faint">{faTime(e.createdAt)}</span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="تحویل‌های اخیر" subtitle="در اختیار کارمندان" />
          <CardBody className="!p-0">
            <div className="max-h-80 overflow-y-auto">
              {data.recentAssignments.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-ink-faint">تحویلی ثبت نشده</p>
              ) : (
                data.recentAssignments.map((a) => (
                  <Link key={a.id} href={`/assets/${a.asset.id}`}
                    className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-0 hover:bg-paper-soft/50">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium">{a.asset.name}</p>
                      <p className="text-[11px] text-ink-faint">به {a.employee.fullName}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-ink-faint">{faTime(a.assignedAt)}</span>
                  </Link>
                ))
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={`درخواست‌های باز (${faNum(data.openRequests.length)})`}
            subtitle="در گردش تأیید"
            action={<Link href="/requests" className="text-[11px] text-ink-soft hover:text-ink">همه ←</Link>}
          />
          <CardBody className="!p-0">
            <div className="max-h-80 overflow-y-auto">
              {data.openRequests.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-ink-faint">درخواست بازی نیست</p>
              ) : (
                data.openRequests.map((r) => (
                  <Link key={r.id} href="/requests"
                    className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-0 hover:bg-paper-soft/50">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium">{r.title}</p>
                      <p className="text-[11px] text-ink-faint">{r.requester} · <span className="font-mono" dir="ltr">{r.code}</span></p>
                    </div>
                    <span className="badge badge-amber shrink-0">باز</span>
                  </Link>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* نوار تعمیرات باز */}
      {s.maintenanceOpen > 0 && (
        <Link href="/maintenance" className="mt-4 block">
          <Card className="border-amber-200 bg-amber-50/60 transition-colors hover:bg-amber-50">
            <div className="flex items-center gap-3 px-4 py-3">
              <Wrench className="h-5 w-5 text-amber-600" />
              <p className="text-[13px] font-medium text-amber-800">
                {faNum(s.maintenanceOpen)} تعمیر باز دارد — رسیدگی کنید
              </p>
              <span className="mr-auto text-[12px] text-amber-700">مشاهده ←</span>
            </div>
          </Card>
        </Link>
      )}
    </div>
  );
}
