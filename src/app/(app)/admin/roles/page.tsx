"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { ShieldCheck } from "@/components/ui/icon";

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: { permission: { key: string; name: string; group: string } }[];
  _count: { users: number };
}

export default function AdminRolesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => api<{ roles: Role[]; permissions: { key: string; name: string; group: string }[] }>("/api/admin/roles"),
  });

  if (isLoading || !data) {
    return <div className="p-6"><SkeletonBlock className="h-40" /><SkeletonBlock className="mt-4 h-40" /></div>;
  }

  // گروه‌بندی مجوزها
  const groups = new Map<string, { key: string; name: string }[]>();
  for (const p of data.permissions) {
    const arr = groups.get(p.group) ?? [];
    arr.push({ key: p.key, name: p.name });
    groups.set(p.group, arr);
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold">نقش‌ها و مجوزها</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {faNum(data.roles.length)} نقش · {faNum(data.permissions.length)} مجوز
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.roles.map((r) => {
          const permKeys = new Set(r.permissions.map((p) => p.permission.key));
          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between border-b border-line px-4 py-3">
                <div>
                  <p className="text-[14px] font-bold">{r.name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{r.description ?? r.key}</p>
                </div>
                <span className="badge badge-blue">{faNum(r._count.users)} کاربر</span>
              </div>
              <CardBody className="!p-0">
                <div className="max-h-72 space-y-2.5 overflow-y-auto p-4">
                  {[...groups.entries()].map(([g, perms]) => (
                    <div key={g}>
                      <p className="mb-1 text-[11px] font-bold text-ink-soft">{g}</p>
                      <div className="flex flex-wrap gap-1">
                        {perms.map((p) => (
                          <span
                            key={p.key}
                            className={`badge ${permKeys.has(p.key) ? "badge-green" : "badge-gray opacity-50"}`}
                            title={p.key}
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-faint">
        <ShieldCheck className="h-3.5 w-3.5" />
        مجوزهای سبز فعال هستند — ویرایش ماتریس نقش‌ها از API (فاز ۱) در دسترس است.
      </p>
    </div>
  );
}
