"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { faNum } from "@/lib";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ArrowLeft, Download, CheckCircle2, XCircle, ExternalLink } from "@/components/ui/icon";

interface ImportReport {
  dryRun: boolean;
  summary: { total: number; valid: number; errors: number; created?: number };
  report: {
    row: number; status: "VALID" | "ERROR"; errors?: Record<string, string>;
    name: string; typeCode: string;
  }[];
  created?: string[];
}

const SAMPLE_CSV = `name,typeCode,brand,model,serialNumber,purchaseDate,purchasePrice
لپ‌تاپ لنوو ۱,LAP,Lenovo,ThinkPad E14,SN-IMP-001,2026-01-15,45000000
موس لاجیتک,MOU,Logitech,M185,SN-IMP-002,2026-02-01,850000
مانیتور سامسونگ,MON,Samsung,LS24,SN-IMP-003,2026-03-10,12000000`;

export default function ImportAssetsPage() {
  const qc = useQueryClient();
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function readFile(f: File) {
    const text = await f.text();
    setCsv(text);
    setFileName(f.name);
    setResult(null);
  }

  async function preview() {
    if (!csv.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await api<ImportReport>("/api/assets/import?dryRun=1", {
        method: "POST", json: { csv },
      });
      setResult(res);
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  async function doImport() {
    setBusy(true); setError(null);
    try {
      const res = await api<ImportReport>("/api/assets/import", {
        method: "POST", json: { csv },
      });
      setResult(res);
      qc.invalidateQueries({ queryKey: ["assets"] });
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "خطا");
    } finally { setBusy(false); }
  }

  function downloadSample() {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-import.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const done = result && result.dryRun === false;

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/assets" className="mb-1 inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />دارایی‌ها
        </Link>
        <h1 className="text-xl font-bold">ورود گروهی دارایی از CSV</h1>
        <p className="mt-1 text-[13px] text-ink-soft">اعتبارسنجی و پیش‌نمایش قبل از ثبت نهایی</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="۱) فایل CSV" subtitle="UTF-8 — یا متن را بچسبانید" />
          <CardBody>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
            >
              <ExternalLink className="h-6 w-6" />
              <span className="text-[12px]">{fileName || "انتخاب فایل CSV…"}</span>
            </button>
            <textarea
              value={csv}
              onChange={(e) => { setCsv(e.target.value); setResult(null); }}
              rows={7}
              dir="ltr"
              placeholder="name,typeCode,brand,..."
              className="mt-3 w-full rounded-md border border-[#d9d9e0] px-3.5 py-2 text-left font-mono text-[11px] outline-none focus:border-ink"
            />
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadSample}>
                <Download className="h-3.5 w-3.5" />نمونه CSV
              </Button>
              <Button size="sm" loading={busy} disabled={!csv.trim()} onClick={preview}>
                اعتبارسنجی و پیش‌نمایش
              </Button>
            </div>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="۲) پیش‌نمایش"
            subtitle={result ? `${faNum(result.summary.total)} سطر` : "بعد از اعتبارسنجی"}
          />
          <CardBody className="!p-0">
            {!result ? (
              <p className="px-4 py-10 text-center text-[12px] text-ink-faint">
                فایل را انتخاب و اعتبارسنجی کنید
              </p>
            ) : done ? (
              <div className="p-4">
                <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-3 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-[13px] font-medium">
                    {faNum(result.summary.created ?? 0)} دارایی ساخته شد — کدها:
                  </p>
                </div>
                <div className="mt-3 max-h-52 overflow-y-auto font-mono text-[11px]" dir="ltr">
                  {(result.created ?? []).map((c) => (
                    <p key={c} className="border-b border-line px-3 py-1.5 last:border-0">{c}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <div className="sticky top-0 flex gap-2 border-b border-line bg-white px-4 py-2.5">
                  <span className="badge badge-green">معتبر: {faNum(result.summary.valid)}</span>
                  <span className="badge badge-red">خطا: {faNum(result.summary.errors)}</span>
                </div>
                {result.report.map((r) => (
                  <div key={r.row} className="flex items-start gap-2 border-b border-line px-4 py-2 last:border-0">
                    {r.status === "VALID"
                      ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px]">{r.name} <span className="text-ink-faint">({r.typeCode})</span></p>
                      {r.errors && (
                        <p className="text-[11px] text-red-600">
                          {Object.entries(r.errors).map(([f, m]) => `${f}: ${Array.isArray(m) ? m[0] : m}`).join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-ink-faint">سطر {faNum(r.row)}</span>
                  </div>
                ))}
                <div className="border-t border-line p-3">
                  <Button
                    className="w-full"
                    loading={busy}
                    disabled={result.summary.valid === 0}
                    onClick={doImport}
                  >
                    ثبت {faNum(result.summary.valid)} دارایی معتبر
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
