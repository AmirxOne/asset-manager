"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { Card, EmptyState, SkeletonTable } from "@/components/ui/card";
import { StatusBadge, ConditionBadge } from "@/components/ui/badges";
import { UserRound } from "@/components/ui/icon";

interface MyAsset {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  status: string;
  condition: string;
  assetType: { name: string; category: { name: string } };
}

export default function MyAssetsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-assets"],
    queryFn: () => api<{ assets: MyAsset[]; hasEmployee: boolean }>("/api/my-assets"),
  });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold">دارایی‌های من</h1>
        <p className="mt-1 text-[13px] text-ink-soft">دارایی‌هایی که الان نزد شماست</p>
      </div>

      <Card>
        {isLoading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : !data ? null : !data.hasEmployee ? (
          <EmptyState
            icon={<UserRound className="h-10 w-10" />}
            title="حساب شما به پرونده کارمندی متصل نیست"
            description="از مدیر دارایی بخواهید حساب شما را به پرونده پرسنلی متصل کند"
          />
        ) : data.assets.length === 0 ? (
          <EmptyState
            icon={<UserRound className="h-10 w-10" />}
            title="دارایی‌ای نزد شما نیست"
            description="وقتی دارایی‌ای به شما تحویل شود اینجا می‌بینید"
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <th className="px-4 py-2.5 text-right font-medium">کد</th>
                <th className="px-4 py-2.5 text-right font-medium">نام</th>
                <th className="px-4 py-2.5 text-right font-medium">نوع</th>
                <th className="px-4 py-2.5 text-right font-medium">وضع ظاهری</th>
              </tr>
            </thead>
            <tbody>
              {data.assets.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0 hover:bg-paper-soft/50">
                  <td className="px-4 py-3">
                    <Link href={`/assets/${a.id}`} className="font-medium hover:underline" dir="ltr">{a.code}</Link>
                  </td>
                  <td className="px-4 py-3">{a.name}{a.brand ? <span className="text-ink-faint"> · {a.brand}</span> : null}</td>
                  <td className="px-4 py-3 text-ink-soft">{a.assetType.category.name} / {a.assetType.name}</td>
                  <td className="px-4 py-3"><ConditionBadge condition={a.condition} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {data && data.assets.length > 0 && (
        <p className="mt-3 text-[12px] text-ink-faint">{faNum(data.assets.length)} دارایی در اختیار شماست</p>
      )}
    </div>
  );
}
