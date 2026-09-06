"use client";

import { use, useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ArrowLeft, Search, CheckCircle2, XCircle, AlertCircle, MessageQuestion } from "@/components/ui/icon";

interface Progress {
  session: {
    id: string; code: string; title: string; status: string;
    expectedTotal: number; createdAt: string;
    createdBy: { fullName: string };
  };
  counts: { expected: number; scanned: number; match: number; mismatch: number; unexpected: number; missing: number };
  missingAssets: { assetId: string; code: string }[];
  scans: {
    id: string; result: string; scannedCode: string; scannedAt: string;
    expectedStatus: string | null; foundStatus: string | null;
    asset: { id: string; code: string; name: string } | null;
    scannedBy: { fullName: string };
  }[];
}

const RESULT_FA: Record<string, string> = {
  MATCH: "مطابق", MISMATCH: "مغایر", UNEXPECTED: "غیرمنتظره", DUPLICATE: "تکراری",
};

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [lastResult, setLastResult] = useState<{ result: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closeModal, setCloseModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => api<Progress>(`/api/audits/${id}`),
    refetchInterval: (q) => ((q.state.data as Progress | undefined)?.session.status === "OPEN" ? 5000 : false),
  });

  async function submitScan(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return;
    setError(null);
    try {
      const res = await api<{ result: string }>(`/api/audits/${id}/scan`, {
        method: "POST",
        json: { code },
      });
      setLastResult({ result: res.result, label: RESULT_FA[res.result] ?? res.result });
      setCode("");
      qc.invalidateQueries({ queryKey: ["audit", id] });
      inputRef.current?.focus();
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    }
  }

  async function doClose() {
    try {
      await api(`/api/audits/${id}/close`, { method: "POST" });
      setCloseModal(false);
      qc.invalidateQueries({ queryKey: ["audit", id] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    }
  }

  if (!data) {
    return <div className="p-6"><div className="skeleton h-40 w-full rounded-md" /></div>;
  }

  const { session, counts, missingAssets, scans } = data;
  const isOpen = session.status === "OPEN";

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/audits" className="mb-1 inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />ممیزی‌ها
          </Link>
          <h1 className="text-xl font-bold">{session.title}</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            <span className="font-mono" dir="ltr">{session.code}</span> · {session.createdBy.fullName}
          </p>
        </div>
        {isOpen && can("audit:manage") && (
          <Button variant="danger" onClick={() => setCloseModal(true)}>بستن ممیزی</Button>
        )}
      </div>

      {/* شمارنده‌ها */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "انتظار", value: counts.expected, cls: "text-ink" },
          { label: "اسکن‌شده", value: counts.scanned, cls: "text-blue-600" },
          { label: "مطابق", value: counts.match, cls: "text-emerald-600" },
          { label: "مغایر", value: counts.mismatch, cls: "text-amber-600" },
          { label: "غیرمنتظره", value: counts.unexpected, cls: "text-purple-600" },
          { label: "مفقود", value: counts.missing, cls: "text-red-600" },
        ].map((s) => (
          <Card key={s.label} className="!p-0">
            <div className="px-4 py-3">
              <p className={`text-xl font-bold ${s.cls}`}>{faNum(s.value)}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* باکس اسکن */}
        {isOpen && can("audit:scan") && (
          <Card className="lg:col-span-1">
            <CardHeader title="اسکن" subtitle="کد یا URL کامل QR را وارد/بچسبانید" />
            <CardBody>
              <form onSubmit={submitScan}>
                <input
                  ref={inputRef}
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="AST-IT-LAP-000001"
                  autoFocus
                  className="h-12 w-full rounded-md border-2 border-[#d9d9e0] px-4 text-left font-mono text-[14px] outline-none focus:border-ink"
                />
                <Button type="submit" className="mt-3 w-full" disabled={!code.trim()}>
                  <Search className="h-4 w-4" />
                  ثبت اسکن
                </Button>
              </form>
              {lastResult && (
                <div className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2.5 text-[13px] font-medium ${
                  lastResult.result === "MATCH" ? "bg-emerald-50 text-emerald-700"
                  : lastResult.result === "MISMATCH" ? "bg-amber-50 text-amber-700"
                  : lastResult.result === "DUPLICATE" ? "bg-paper-soft text-ink-soft"
                  : "bg-purple-50 text-purple-700"
                }`}>
                  {lastResult.result === "MATCH" ? <CheckCircle2 className="h-4 w-4" />
                  : lastResult.result === "MISMATCH" ? <AlertCircle className="h-4 w-4" />
                  : lastResult.result === "DUPLICATE" ? <MessageQuestion className="h-4 w-4" />
                  : <XCircle className="h-4 w-4" />}
                  {lastResult.label}
                </div>
              )}
              {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
            </CardBody>
          </Card>
        )}

        {/* مفقودی‌ها */}
        <Card className={isOpen ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader
            title={`مفقودی‌ها (${faNum(missingAssets.length)})`}
            subtitle="در محدوده بودند اما اسکن نشدند"
          />
          <CardBody className="!p-0">
            {missingAssets.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-ink-faint">
                {counts.scanned === 0 ? "هنوز اسکنی ثبت نشده" : "همه پیدا شدند 🎉"}
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {missingAssets.map((m) => (
                  <Link key={m.assetId} href={`/assets/${m.assetId}`}
                    className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px] last:border-0 hover:bg-paper-soft/50">
                    <span className="font-mono" dir="ltr">{m.code}</span>
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* اسکن‌های اخیر */}
      <Card className="mt-4">
        <CardHeader title={`اسکن‌های اخیر (${faNum(scans.length)})`} />
        <CardBody className="!p-0">
          <div className="max-h-96 overflow-y-auto">
            {scans.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
                <span className={`badge ${
                  s.result === "MATCH" ? "badge-green" : s.result === "MISMATCH" ? "badge-amber" : "badge-gray"
                }`}>{RESULT_FA[s.result]}</span>
                <span className="font-mono text-[12px]" dir="ltr">{s.scannedCode}</span>
                {s.asset && <Link href={`/assets/${s.asset.id}`} className="text-ink-soft hover:text-ink">{s.asset.name}</Link>}
                {s.result === "MISMATCH" && (
                  <span className="text-[11px] text-amber-700">
                    انتظار: {s.expectedStatus} · فعلی: {s.foundStatus}
                  </span>
                )}
                <span className="mr-auto text-[11px] text-ink-faint">{s.scannedBy.fullName}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* مودال بستن */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="بستن ممیزی">
        <div className="space-y-4">
          <p className="text-[13px] text-ink-soft">
            با بستن، گزارش نهایی ثبت می‌شود و برای {faNum(counts.missing)} دارایی مفقود رویداد «مفقود در ممیزی» ثبت خواهد شد.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCloseModal(false)}>انصراف</Button>
            <Button variant="danger" onClick={doClose}>بستن و ثبت گزارش</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
