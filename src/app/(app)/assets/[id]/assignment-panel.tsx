"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { UserCheck, ArrowLeft } from "@/components/ui/icon";
import { ASSET_CONDITION_FA } from "@/components/ui/badges";
import { useAuth } from "@/lib/auth-store";

interface EmployeeOpt { id: string; fullName: string; personnelCode: string; department: { name: string } | null }

/** پنل عملیات تخصیص — تحویل / عودت / انتقال */
export function AssignmentPanel({ assetId, status }: { assetId: string; status: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | "assign" | "return" | "transfer">(null);
  const [employeeId, setEmployeeId] = useState("");
  const [toEmployeeId, setToEmployeeId] = useState("");
  const [toStatus, setToStatus] = useState("AVAILABLE");
  const [condition, setCondition] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: emps } = useQuery({
    queryKey: ["employees-options"],
    queryFn: () => api<{ employees: EmployeeOpt[] }>("/api/employees?options=1"),
    // پیش‌fetch — گزینه‌ها قبل از باز شدن مودال آماده‌اند (flaky E2E ریشه‌ای حل شد)
    enabled: can("asset:assign") || can("asset:transfer"),
    staleTime: 60_000,
  });

  const isAssigned = status === "ASSIGNED" || status === "IN_USE";
  const canAssign = can("asset:assign") && !isAssigned;
  const canReturn = can("asset:return") && isAssigned;
  const canTransfer = can("asset:transfer") && isAssigned;

  async function submit() {
    if (!modal) return;
    setBusy(true); setError(null);
    try {
      if (modal === "assign") {
        await api(`/api/assets/${assetId}/assign`, {
          method: "POST",
          json: { employeeId, ...(note ? { note } : {}) },
        });
      } else if (modal === "return") {
        await api(`/api/assets/${assetId}/return`, {
          method: "POST",
          json: {
            toStatus,
            ...(condition ? { condition } : {}),
            ...(note ? { note } : {}),
          },
        });
      } else if (modal === "transfer") {
        await api(`/api/assets/${assetId}/transfer`, {
          method: "POST",
          json: { toEmployeeId, ...(note ? { note } : {}) },
        });
      }
      setModal(null);
      setEmployeeId(""); setToEmployeeId(""); setNote(""); setCondition("");
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      window.location.reload();
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  if (!canAssign && !canReturn && !canTransfer) return null;

  const empOptions = (emps?.employees ?? []).map((e) => ({
    value: e.id,
    label: e.fullName,
    hint: `${e.personnelCode}${e.department ? ` · ${e.department.name}` : ""}`,
  }));

  return (
    <Card>
      <CardHeader title="عملیات تخصیص" subtitle="تحویل، عودت و انتقال" />
      <CardBody className="space-y-2">
        {canAssign && (
          <Button className="w-full justify-start" onClick={() => setModal("assign")}>
            <UserCheck className="h-4 w-4" />
            تحویل به کارمند
          </Button>
        )}
        {canReturn && (
          <Button variant="outline" className="w-full justify-start" onClick={() => setModal("return")}>
            <ArrowLeft className="h-4 w-4" />
            عودت دارایی
          </Button>
        )}
        {canTransfer && (
          <Button variant="secondary" className="w-full justify-start" onClick={() => setModal("transfer")}>
            <ArrowLeft className="h-4 w-4" />
            انتقال به کارمند دیگر
          </Button>
        )}
      </CardBody>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === "assign" ? "تحویل دارایی" : modal === "return" ? "عودت دارایی" : "انتقال دارایی"
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>انصراف</Button>
            <Button loading={busy} onClick={submit}>
              {modal === "assign" ? "تحویل" : modal === "return" ? "عودت" : "انتقال"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {modal === "assign" && (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">تحویل به *</label>
              <Select value={employeeId} onChange={setEmployeeId} placeholder="انتخاب کارمند…" options={empOptions} />
            </div>
          )}
          {modal === "transfer" && (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">انتقال به *</label>
              <Select value={toEmployeeId} onChange={setToEmployeeId} placeholder="انتخاب کارمند…" options={empOptions} />
            </div>
          )}
          {modal === "return" && (
            <>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium">عودت به *</label>
                <Select
                  value={toStatus}
                  onChange={setToStatus}
                  options={[
                    { value: "AVAILABLE", label: "موجود (آزاد)" },
                    { value: "IN_STOCK", label: "در انبار" },
                  ]}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium">وضع ظاهری هنگام عودت</label>
                <Select
                  value={condition}
                  onChange={setCondition}
                  placeholder="بدون تغییر"
                  options={Object.entries(ASSET_CONDITION_FA).map(([value, l]) => ({ value, label: l }))}
                />
              </div>
            </>
          )}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" htmlFor="op-note">یادداشت</label>
            <textarea id="op-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-[#d9d9e0] px-3.5 py-2 text-[13px] outline-none focus:border-ink" />
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
        </div>
      </Modal>
    </Card>
  );
}
