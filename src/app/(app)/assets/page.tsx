"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn, faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SkeletonTable } from "@/components/ui/card";
import { FilterBar, type FilterChipsGroup } from "@/components/ui/filter-bar";
import { StatusBadge, ConditionBadge, ASSET_STATUS_FA, ASSET_CONDITION_FA } from "@/components/ui/badges";
import { Plus, Search, Layers } from "@/components/ui/icon";
import { BulkBar } from "./bulk-bar";

interface AssetRow {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: string;
  condition: string;
  purchasePrice: string | null;
  assetType: { name: string; code: string; category: { name: string; code: string } };
}

interface ListResp {
  data: AssetRow[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AssetsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({
    status: "", categoryId: "", condition: "",
  });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canBulk = can("asset:bulk");

  // پارامترهای URL (?q= جستجو / ?status= از داشبورد) را در mount بخوان
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const uq = sp.get("q");
    const us = sp.get("status");
    if (uq) setQ(uq);
    if (us) setFilters((f) => ({ ...f, status: us }));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ categories: { id: string; name: string; code: string }[] }>("/api/categories"),
  });

  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  params.set("page", String(page));
  params.set("pageSize", "25");

  const { data, isLoading } = useQuery({
    queryKey: ["assets", params.toString()],
    queryFn: () => api<ListResp>(`/api/assets?${params.toString()}`),
  });

  const groups: FilterChipsGroup[] = [
    {
      key: "status",
      label: "وضعیت",
      options: Object.entries(ASSET_STATUS_FA).map(([value, label]) => ({ value, label })),
    },
    {
      key: "categoryId",
      label: "دسته",
      options: (cats?.categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: "condition",
      label: "وضع ظاهری",
      options: Object.entries(ASSET_CONDITION_FA).map(([value, label]) => ({ value, label })),
    },
  ];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">دارایی‌ها</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {data ? `${faNum(data.total)} دارایی` : "در حال بارگذاری…"}
          </p>
        </div>
        <div className="flex gap-2">
          {can("asset:create") && (
            <Link href="/assets/import">
              <Button variant="outline">
                ورود از CSV
              </Button>
            </Link>
          )}
          {can("asset:create") && (
            <Link href="/assets/new">
              <Button>
                <Plus className="h-4 w-4" />
                ثبت دارایی جدید
              </Button>
            </Link>
          )}
        </div>
      </div>

      <FilterBar groups={groups} value={filters} onChange={(v) => { setFilters(v); setPage(1); }}>
        <div className="flex h-9 flex-1 items-center gap-2 rounded-md border border-line bg-white px-3">
          <Search className="h-3.5 w-3.5 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="کد، نام، برند، مدل، سریال…"
            className="w-full bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
          />
        </div>
      </FilterBar>

      <Card className="mt-4">
        {isLoading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-10 w-10" />}
            title="دارایی‌ای یافت نشد"
            description={
              data && data.total === 0 && (q || Object.values(filters).some(Boolean))
                ? "فیلترها را تغییر دهید یا جستجو را پاک کنید"
                : "هنوز دارایی ثبت نشده — اولین دارایی را ثبت کنید"
            }
            action={can("asset:create") && !q && !Object.values(filters).some(Boolean) ? (
              <Link href="/assets/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  ثبت دارایی جدید
                </Button>
              </Link>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                  {canBulk && <th className="w-10 px-4 py-2.5"></th>}
                  <th className="px-4 py-2.5 text-right font-medium">کد</th>
                  <th className="px-4 py-2.5 text-right font-medium">نام</th>
                  <th className="px-4 py-2.5 text-right font-medium">دسته / نوع</th>
                  <th className="px-4 py-2.5 text-right font-medium">وضعیت</th>
                  <th className="px-4 py-2.5 text-right font-medium">وضع ظاهری</th>
                  <th className="px-4 py-2.5 text-left font-medium">قیمت خرید</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-paper-soft/50">
                    {canBulk && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={() => toggle(a.id)}
                          aria-label={`انتخاب ${a.code}`}
                          className="h-4 w-4 cursor-pointer accent-black"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link href={`/assets/${a.id}`} className="font-medium text-ink hover:underline" dir="ltr">
                        {a.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/assets/${a.id}`} className="hover:underline">
                        {a.name}
                      </Link>
                      {a.brand && <span className="text-ink-faint"> · {a.brand}</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {a.assetType.category.name} / {a.assetType.name}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3"><ConditionBadge condition={a.condition} /></td>
                    <td className="px-4 py-3 text-left text-ink-soft" dir="ltr">
                      {a.purchasePrice ? faNum(Number(a.purchasePrice).toLocaleString("en-US")) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[12px] text-ink-soft">
                <span>صفحه {faNum(page)} از {faNum(totalPages)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    قبلی
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    بعدی
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      <BulkBar ids={[...selected]} onClear={() => setSelected(new Set())} />
    </div>
  );
}
