"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Printer } from "@/components/ui/icon";
import { ASSET_STATUS_FA } from "@/components/ui/badges";

interface EmployeeOpt { id: string; fullName: string; personnelCode: string }

/** نوار عملیات گروهی — انتخاب چند دارایی → تغییر وضعیت/تحویل گروهی */
export function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | "STATUS" | "ASSIGN">(null);
  const [to, setTo] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [result, setResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: emps } = useQuery({
    queryKey: ["employees-options"],
    queryFn: () => api<{ employees: EmployeeOpt[] }>("/api/employees?options=1"),
    enabled: modal === "ASSIGN",
  });

  if (ids.length === 0 || !can("asset:bulk")) return null;

  async function submit() {
    if (!modal) return;
    setBusy(true);
    try {
      const res = await api<{ succeeded: number; failed: number }>("/api/assets/bulk", {
        method: "POST",
        json: {
          action: modal,
          ids,
          ...(modal === "STATUS" && to ? { to } : {}),
          ...(modal === "ASSIGN" && employeeId ? { employeeId } : {}),
        },
      });
      setResult({ succeeded: res.succeeded, failed: res.failed });
      qc.invalidateQueries({ queryKey: ["assets"] });
      setTimeout(() => {
        setModal(null);
        setResult(null);
        onClear();
      }, 1400);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* نوار شناور */}
      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
        <span className="text-[12px] font-medium">{faNum(ids.length)} دارایی انتخاب شد</span>
        <div className="mx-1 h-5 w-px bg-line" />
        <Button size="sm" onClick={() => { setTo(""); setModal("STATUS"); }}>
          تغییر وضعیت
        </Button>
        {can("asset:assign") && (
          <Button size="sm" variant="secondary" onClick={() => { setEmployeeId(""); setModal("ASSIGN"); }}>
            تحویل گروهی
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`/api/labels/print?ids=${ids.join(",")}`, "_blank")}
        >
          <Printer className="h-3.5 w-3.5" />
          چاپ برچسب‌ها
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          لغو
        </Button>
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "STATUS" ? "تغییر وضعیت گروهی" : "تحویل گروهی"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>انصراف</Button>
            <Button
              loading={busy}
              disabled={(modal === "STATUS" && !to) || (modal === "ASSIGN" && !employeeId)}
              onClick={submit}
            >
              اجرا روی {faNum(ids.length)} دارایی
            </Button>
          </div>
        }
      >
        {result ? (
          <div className="space-y-1 py-4 text-center">
            <p className="text-[14px] font-medium text-emerald-600">
              ✅ {faNum(result.succeeded)} دارایی با موفقیت انجام شد
            </p>
            {result.failed > 0 && (
              <p className="text-[12px] text-red-600">
                {faNum(result.failed)} مورد ناموفق (گذار غیرمجاز یا خطا)
              </p>
            )}
          </div>
        ) : modal === "STATUS" ? (
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">وضعیت مقصد *</label>
            <Select value={to} onChange={setTo} placeholder="انتخاب وضعیت…"
              options={Object.entries(ASSET_STATUS_FA).map(([value, label]) => ({ value, label }))} />
            <p className="mt-2 text-[11px] text-ink-faint">
              موارد با گذار غیرمجاز رد می‌شوند و گزارش داده می‌شود
            </p>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">تحویل به *</label>
            <Select value={employeeId} onChange={setEmployeeId} placeholder="انتخاب کارمند…"
              options={(emps?.employees ?? []).map((e) => ({
                value: e.id, label: e.fullName, hint: e.personnelCode,
              }))} />
            <p className="mt-2 text-[11px] text-ink-faint">
              دارایی‌های قبلاً تحویل‌شده رد می‌شوند
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
