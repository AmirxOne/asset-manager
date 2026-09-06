"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { Card, CardHeader, CardBody, SkeletonBlock, StatCard } from "@/components/ui/card";
import { ASSET_STATUS_FA, ASSET_CONDITION_FA } from "@/components/ui/badges";
import { DoorOpen } from "@/components/ui/icon";

interface Summary {
  total: number;
  status: Record<string, number>;
  condition: Record<string, number>;
  totalValue: string;
  byLocation: { location: { id: string; name: string; type: string }; count: number }[];
}

const LOC_TYPE_FA: Record<string, string> = {
  BUILDING: "ساختمان", FLOOR: "طبقه", ROOM: "اتاق", WAREHOUSE: "انبار", BRANCH: "شعبه",
};

export default function WarehousePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["warehouse-summary"],
    queryFn: () => api<{ summary: Summary }>("/api/warehouse/summary"),
  });

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <SkeletonBlock className="h-8 w-40" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const s = data.summary;
  const value = Number(s.totalValue);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">انبار</h1>
        <p className="mt-1 text-[13px] text-ink-soft">خلاصه موجودی و توزیع دارایی‌ها</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="کل دارایی‌ها" value={faNum(s.total)} />
        <StatCard label="در انبار" value={faNum(s.status.IN_STOCK ?? 0)} tone="success" />
        <StatCard label="موجود (آزاد)" value={faNum(s.status.AVAILABLE ?? 0)} tone="success" />
        <StatCard label="تحویل‌شده" value={faNum((s.status.ASSIGNED ?? 0) + (s.status.IN_USE ?? 0))} />
        <StatCard label="در تعمیر" value={faNum(s.status.MAINTENANCE ?? 0)} tone="warn" />
        <StatCard label="گم‌شده" value={faNum(s.status.LOST ?? 0)} tone="danger" />
        <StatCard label="بازنشسته" value={faNum(s.status.RETIRED ?? 0)} />
        <StatCard
          label="ارزش کل (ریال)"
          value={faNum(value.toLocaleString("en-US"))}
          hint="بدون بازنشسته و اسقاط"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="بر اساس وضعیت" />
          <CardBody className="p-0">
            {Object.entries(ASSET_STATUS_FA).map(([key, fa]) => {
              const count = s.status[key] ?? 0;
              const pct = s.total > 0 ? Math.round((count / s.total) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0">
                  <span className="w-24 shrink-0 text-[12px] text-ink-soft">{fa}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-left text-[12px] font-medium">{faNum(count)}</span>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="موجودی محل‌ها" subtitle="محل‌هایی که دارایی دارند" />
          <CardBody className="p-0">
            {s.byLocation.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <DoorOpen className="h-8 w-8 text-ink-faint" />
                <p className="text-[12px] text-ink-soft">هنوز دارایی‌ای به محل‌ای اختصاص نیافته</p>
              </div>
            ) : (
              s.byLocation.map(({ location, count }) => (
                <div key={location.id} className="flex items-center justify-between border-b border-line px-5 py-2.5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{location.name}</span>
                    <span className="badge badge-gray">{LOC_TYPE_FA[location.type] ?? location.type}</span>
                  </div>
                  <span className="text-[13px] font-bold">{faNum(count)}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="وضع ظاهری" />
        <CardBody className="p-0">
          {Object.entries(ASSET_CONDITION_FA).map(([key, fa]) => (
            <div key={key} className="flex items-center justify-between border-b border-line px-5 py-2.5 last:border-0">
              <span className="text-[12px] text-ink-soft">{fa}</span>
              <span className="text-[13px] font-medium">{faNum(s.condition[key] ?? 0)}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
