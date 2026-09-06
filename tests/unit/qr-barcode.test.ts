import { describe, it, expect } from "vitest";
import { code39Svg, code39Chars, qrContent } from "@/server/modules/qr";

describe("Code39 barcode encoder", () => {
  it("کد دارایی استاندارد قابل انکود است", () => {
    expect(code39Chars("AST-IT-LAP-000001")).toBe(true);
    expect(code39Chars("AST-NET-SRV-1234")).toBe(true);
  });

  it("نویسه فارسی/نامعتبر رد می‌شود", () => {
    expect(code39Chars("دارایی")).toBe(false);
    expect(code39Chars("AST_IT")).toBe(false); // underscore در Code39 نیست
  });

  it("SVG ساختار درست دارد — start/stop * + متن", () => {
    const svg = code39Svg("AST-IT-LAP-000001", 40);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("</svg>");
    // rect ها (میله‌ها) وجود دارند
    const bars = (svg.match(/<rect/g) ?? []).length;
    expect(bars).toBeGreaterThan(20);
    // متن قابل‌چاپ زیر بارکد
    expect(svg).toContain(">AST-IT-LAP-000001</text>");
  });

  it("الگوی * (start/stop) معتبر است", () => {
    // * باید در جدول باشد چون جداکننده است
    expect(code39Chars("*")).toBe(true);
  });

  it("کدهای مختلف طول‌های متفاوت می‌سازند", () => {
    const s1 = code39Svg("A", 40);
    const s2 = code39Svg("AST-IT-LAP-000001", 40);
    const w1 = Number(s1.match(/viewBox="0 0 (\d+)/)![1]);
    const w2 = Number(s2.match(/viewBox="0 0 (\d+)/)![1]);
    expect(w2).toBeGreaterThan(w1);
  });
});

describe("QR content (ADR-007)", () => {
  it("محتوا URL مطلق /a/{code} است", () => {
    expect(qrContent("http://localhost:3200", "AST-IT-LAP-000001")).toBe(
      "http://localhost:3200/a/AST-IT-LAP-000001",
    );
  });

  it("اسلش انتهایی baseUrl حذف می‌شود", () => {
    expect(qrContent("http://localhost:3200/", "X-1")).toBe("http://localhost:3200/a/X-1");
  });

  it("کد با نویسه خاص URL-encode می‌شود", () => {
    expect(qrContent("http://x", "A B")).toBe("http://x/a/A%20B");
  });
});
