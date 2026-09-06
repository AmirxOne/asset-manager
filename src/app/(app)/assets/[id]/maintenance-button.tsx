"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Wrench } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth-store";
import { useQueryClient } from "@tanstack/react-query";

/** دکمه ارسال به تعمیر در جزئیات دارایی (وقتی MAINTENANCE در گذارهای مجاز است) */
export function MaintenanceButton({ assetId, status }: { assetId: string; status: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [problem, setProblem] = useState("");
  const [technician, setTechnician] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // فقط وقتی گذار به MAINTENANCE مجاز است
  const allowedFrom = ["IN_STOCK", "AVAILABLE", "ASSIGNED", "IN_USE"];
  if (!can("maintenance:manage") || !allowedFrom.includes(status)) return null;

  async function submit() {
    setBusy(true); setError(null);
    try {
      await api("/api/maintenances", {
        method: "POST",
        json: {
          assetId,
          problem,
          ...(technician ? { technicianName: technician } : {}),
        },
      });
      setModal(false); setProblem(""); setTechnician("");
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      window.location.reload();
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader title="تعمیر" subtitle="ارسال دارایی به تعمیرگاه" />
      <CardBody>
        <Button variant="outline" className="w-full justify-start" onClick={() => setModal(true)}>
          <Wrench className="h-4 w-4" />
          ارسال به تعمیر
        </Button>
      </CardBody>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="ارسال به تعمیر"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button loading={busy} disabled={problem.trim().length < 3} onClick={submit}>
              ثبت و ارسال
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" htmlFor="maint-problem">شرح ایراد *</label>
            <textarea id="maint-problem" rows={2} value={problem} onChange={(e) => setProblem(e.target.value)}
              className="w-full rounded-md border border-[#d9d9e0] px-3.5 py-2 text-[13px] outline-none focus:border-ink" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" htmlFor="maint-tech">تعمیرکار (اختیاری)</label>
            <input id="maint-tech" value={technician} onChange={(e) => setTechnician(e.target.value)}
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink" />
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
        </div>
      </Modal>
    </Card>
  );
}
