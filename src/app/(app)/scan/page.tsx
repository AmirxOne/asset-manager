"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Search, XCircle } from "@/components/ui/icon";

/**
 * اسکنر — دوربین (BarcodeDetector اگر موجود) + ورودی دستی.
 * QR دارایی حاوی /a/{code} است؛ فقط کد استخرج و به آنجا می‌رویم.
 */
export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  // استخراج کد از هر متن اسکن‌شده: یا /a/CODE یا خود کد
  function extractCode(raw: string): string {
    const trimmed = raw.trim();
    const m = trimmed.match(/\/a\/([A-Za-z0-9-]+)/);
    if (m) return m[1].toUpperCase();
    return trimmed.toUpperCase();
  }

  function go(code: string) {
    if (!code) return;
    setStatus(`در حال رفتن به ${code}…`);
    router.push(`/a/${encodeURIComponent(code)}`);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      detectLoop();
    } catch {
      setCameraError("دسترسی به دوربین ممکن نشد — از ورودی دستی استفاده کنید");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function detectLoop() {
    const video = videoRef.current;
    if (!video) return;
    const Detector = (window as unknown as { BarcodeDetector?: new (o?: { formats?: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector) {
      setCameraError("مرورگر شما اسکن دوربین را پشتیبانی نمی‌کند — ورودی دستی");
      return;
    }
    const detector = new Detector({ formats: ["qr_code", "code_39", "code_128"] });
    const tick = async () => {
      if (!streamRef.current || !videoRef.current) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0 && codes[0].rawValue) {
          stopCamera();
          go(extractCode(codes[0].rawValue));
          return;
        }
      } catch {
        /* skip frame */
      }
      requestAnimationFrame(() => void tick());
    };
    void tick();
  }

  useEffect(() => stopCamera, []);

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold">اسکن دارایی</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          QR یا بارکد دارایی را اسکن کنید یا کد را دستی وارد کنید
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="دوربین" subtitle="QR / Code39 / Code128" />
          <CardBody>
            <div className="relative overflow-hidden rounded-md bg-black" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
                  <Search className="h-8 w-8" />
                  <p className="text-[12px]">دوربین خاموش است</p>
                </div>
              )}
              {cameraOn && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-32 w-32 rounded-lg border-2 border-white/80" />
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {!cameraOn ? (
                <Button onClick={startCamera} className="flex-1">روشن کردن دوربین</Button>
              ) : (
                <Button variant="danger" onClick={stopCamera} className="flex-1">
                  <XCircle className="h-4 w-4" />
                  خاموش کردن
                </Button>
              )}
            </div>
            {cameraError && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-700">{cameraError}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="ورودی دستی" subtitle="کد دارایی مثل AST-IT-LAP-000001" />
          <CardBody>
            <input
              dir="ltr"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go(extractCode(manual))}
              placeholder="AST-IT-LAP-000001"
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-left font-mono text-[13px] outline-none focus:border-ink"
            />
            <Button className="mt-3 w-full" onClick={() => go(extractCode(manual))}>
              برو به دارایی
            </Button>
            {status && <p className="mt-2 text-center text-[12px] text-ink-soft">{status}</p>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
