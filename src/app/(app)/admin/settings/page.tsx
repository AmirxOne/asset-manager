import { prisma } from "@/server/db";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Settings, ShieldCheck, LifeBuoy } from "@/components/ui/icon";
import { faNum } from "@/lib";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [assets, users, employees, depts, locs, suppliers, audits, logs] = await Promise.all([
    prisma.asset.count(),
    prisma.user.count(),
    prisma.employee.count(),
    prisma.department.count(),
    prisma.location.count(),
    prisma.supplier.count(),
    prisma.auditSession.count(),
    prisma.auditLog.count(),
  ]);

  const stats: { label: string; value: number }[] = [
    { label: "دارایی‌ها", value: assets },
    { label: "کاربران", value: users },
    { label: "پرونده‌های پرسنلی", value: employees },
    { label: "بخش‌ها", value: depts },
    { label: "محل‌ها", value: locs },
    { label: "تأمین‌کنندگان", value: suppliers },
    { label: "نشست‌های ممیزی", value: audits },
    { label: "رکوردهای لاگ", value: logs },
  ];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-ink-soft" />
        <div>
          <h1 className="text-xl font-bold">تنظیمات و وضعیت سامانه</h1>
          <p className="text-[12px] text-ink-soft">نمای کلی داده‌ها و امنیت</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="px-4 py-3.5">
              <p className="text-[20px] font-bold">{faNum(s.value)}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="زیرساخت" subtitle="پیکربندی فعلی" />
          <CardBody>
            <div className="space-y-2.5 text-[13px]">
              {[
                ["فریم‌ورک", "Next.js 15 (App Router)"],
                ["پایگاه داده", "PostgreSQL 16 + Prisma"],
                ["احراز هویت", "Session (HttpOnly cookie, 7 روز)"],
                ["رمزنگاری رمز", "bcrypt (rounds=12)"],
                ["نرخ‌گیری لاگین", "۵ شکست / ۱۵ دقیقه"],
                ["حذف دارایی", "نرم (Soft delete)"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
                  <span className="text-ink-soft">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="امنیت" subtitle="سیاست‌های فعال" />
          <CardBody>
            <div className="space-y-2 text-[13px]">
              {[
                "همه APIها با session + permission بررسی می‌شوند",
                "Same-Origin برای عملیات نوشتاری",
                "تاریخچه کامل رویداد هر دارایی (AssetEvent)",
                "لاگ عملیات با بازیگر و IP",
                "QR محتوا فقط /a/{code} عمومی است",
              ].map((t) => (
                <p key={t} className="flex items-start gap-2 text-ink-soft">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {t}
                </p>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-1.5 rounded-md bg-paper-soft px-3 py-2 text-[11px] text-ink-faint">
              <LifeBuoy className="h-3.5 w-3.5" />
              تنظیمات پیشرفته (الگوی کد، فاصله شماره‌ها و…) از جدول Settings قابل توسعه است.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
