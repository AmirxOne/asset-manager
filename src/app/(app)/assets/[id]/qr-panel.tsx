"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "@/components/ui/icon";
/** پنل QR/بارکد — نمایش، دانلود و چاپ برچسب یک دارایی */
export function QrPanel({ assetId, code }: { assetId: string; code: string }) {
  const [tab, setTab] = useState<"qr" | "barcode">("qr");
  const { data: svg } = useQuery({
    queryKey: ["asset-qr", assetId, tab],
    queryFn: async () => {
      const res = await fetch(`/api/assets/${assetId}/${tab}`);
      return res.text();
    },
    staleTime: Infinity,
  });

  function download() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${code}-${tab}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader
        title="QR / بارکد"
        subtitle={code}
        action={
          <div className="flex gap-1 rounded-md bg-paper-soft p-0.5">
            <button
              onClick={() => setTab("qr")}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${tab === "qr" ? "bg-white shadow-sm" : "text-ink-soft"}`}
            >
              QR
            </button>
            <button
              onClick={() => setTab("barcode")}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${tab === "barcode" ? "bg-white shadow-sm" : "text-ink-soft"}`}
            >
              بارکد
            </button>
          </div>
        }
      />
      <CardBody className="flex flex-col items-center gap-3">
        <div
          className="flex min-h-[160px] w-full max-w-[200px] items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />
        <div className="flex w-full gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={download}>
            <Download className="h-3.5 w-3.5" />
            دانلود SVG
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open(`/api/labels/print?ids=${assetId}`, "_blank")}
          >
            <Printer className="h-3.5 w-3.5" />
            چاپ برچسب
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
