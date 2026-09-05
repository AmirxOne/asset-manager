"use client";

import { useAuth } from "@/lib/auth-store";
import { Card, CardHeader, CardBody, StatCard, SkeletonBlock } from "@/components/ui/card";
import { faNum } from "@/lib";

export default function DashboardPage() {
  const { me, loaded } = useAuth();

  if (!loaded || !me) {
    return (
      <div className="p-6">
        <SkeletonBlock className="h-8 w-48" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">سلام {me.fullName} 👋</h1>
      <p className="mt-1 text-[13px] text-ink-soft">
        داشبورد مدیریت دارایی — فازهای بعدی این صفحه را با آمار واقعی پر می‌کنند.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="کل دارایی‌ها" value={faNum(0)} hint="فاز ۲" />
        <StatCard label="در استفاده" value={faNum(0)} hint="فاز ۳" />
        <StatCard label="موجودی انبار" value={faNum(0)} hint="فاز ۴" />
        <StatCard label="در تعمیر" value={faNum(0)} hint="فاز ۶" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="فعالیت اخیر" subtitle="پس از فاز ۲" />
          <CardBody>
            <p className="text-[12px] text-ink-soft">هنوز رویدادی ثبت نشده است.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="درخواست‌های در انتظار" subtitle="پس از فاز ۷" />
          <CardBody>
            <p className="text-[12px] text-ink-soft">هنوز درخواستی ثبت نشده است.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
