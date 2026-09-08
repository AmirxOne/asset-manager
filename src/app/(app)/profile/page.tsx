"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { UserCircle, KeyRound, CheckCircle2 } from "@/components/ui/icon";

export default function ProfilePage() {
  const me = useAuth((s) => s.me);
  const qc = useQueryClient();
  const router = useRouter();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: myAssets } = useQuery({
    queryKey: ["my-assets"],
    queryFn: () => api<{ assets: unknown[]; hasEmployee: boolean }>("/api/my-assets"),
  });

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) {
      setMsg({ ok: false, text: "رمز جدید و تکرار آن یکسان نیست" });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      await api("/api/auth/password", {
        method: "PATCH",
        json: { currentPassword: pw.current, newPassword: pw.next },
      });
      setMsg({ ok: true, text: "رمز تغییر کرد — نشست‌های دیگر بسته شد" });
      setPw({ current: "", next: "", confirm: "" });
      setTimeout(() => {
        qc.clear();
        router.push("/login");
      }, 1800);
    } catch (err) {
      setMsg({ ok: false, text: err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا" });
    } finally { setBusy(false); }
  }

  const label = "mb-1.5 block text-[12px] font-medium";
  const input = "h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink";

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold">پروفایل</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="اطلاعات حساب" subtitle={me?.email} />
          <CardBody>
            <div className="flex items-center gap-3">
              <UserCircle className="h-12 w-12 text-ink-soft" />
              <div>
                <p className="text-[15px] font-bold">{me?.fullName}</p>
                <p className="text-[12px] text-ink-soft" dir="ltr">{me?.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(me?.roles ?? []).map((r) => (
                    <span key={r.key} className="badge badge-gray">{r.name}</span>
                  ))}
                </div>
              </div>
            </div>
            {myAssets && (
              <div className="mt-4 rounded-md bg-paper-soft px-4 py-3 text-[12px] text-ink-soft">
                دارایی‌های در اختیار شما: <span className="font-bold text-ink">{myAssets.assets?.length ?? 0}</span> مورد —
                در منوی «دارایی‌های من»
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="تغییر رمز عبور" subtitle="بعد از تغییر، همه نشست‌ها بسته می‌شوند" />
          <CardBody>
            <form onSubmit={changePassword} className="space-y-3.5">
              <div>
                <label className={label} htmlFor="pw-cur">رمز فعلی *</label>
                <input id="pw-cur" type="password" dir="ltr" value={pw.current}
                  onChange={(e) => setPw({ ...pw, current: e.target.value })} className={`${input} text-left`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="pw-new">رمز جدید *</label>
                  <input id="pw-new" type="password" dir="ltr" value={pw.next}
                    onChange={(e) => setPw({ ...pw, next: e.target.value })} className={`${input} text-left`} />
                </div>
                <div>
                  <label className={label} htmlFor="pw-conf">تکرار رمز جدید *</label>
                  <input id="pw-conf" type="password" dir="ltr" value={pw.confirm}
                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className={`${input} text-left`} />
                </div>
              </div>
              {msg && (
                <p className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {msg.ok && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {msg.text}
                </p>
              )}
              <Button type="submit" loading={busy} className="w-full" disabled={!pw.current || pw.next.length < 8 || !pw.confirm}>
                <KeyRound className="h-4 w-4" />
                تغییر رمز
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
